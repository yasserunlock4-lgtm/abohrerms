const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY;
const DB_URL = process.env.FIREBASE_DATABASE_URL;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

// دوال الاتصال بقاعدة البيانات (بدون مكاتب خارجية)
async function getFirebaseToken() {
  try {
    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const now = Math.floor(Date.now() / 1000);
    const payload = btoa(JSON.stringify({
      iss: CLIENT_EMAIL, sub: CLIENT_EMAIL, aud: "https://oauth2.googleapis.com/token",
      iat: now, exp: now + 3600,
      scope: "https://www.googleapis.com/auth/firebase.database"
    } ));

    const key = await crypto.subtle.importKey(
      "pkcs8", pemToBuffer(PRIVATE_KEY),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
    );

    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`));
    const jwt = `${header}.${payload}.${bufferToBase64(sig)}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    } );

    const data = await res.json();
    return data.access_token;
  } catch (e) { return null; }
}

function pemToBuffer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// دالة إرسال الرسالة لتيليجرام
async function sendMessage(chatId, text, button = null) {
  const body = { chat_id: chatId, text: text, parse_mode: "Markdown" };
  if (button && button.label && button.url) {
    body.reply_markup = {
      inline_keyboard: [[
        button.isWebApp ? { text: button.label, web_app: { url: button.url } } : { text: button.label, url: button.url }
      ]]
    };
  }
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ),
  });
}

export default async function handler(req, res) {
  // السماح للوحة التحكم بالاتصال (حل مشكلة CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // التحقق من المفتاح السري
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: "المفتاح السري غير صحيح" });
  }

  const { message, buttonLabel, buttonUrl, isWebApp } = req.body;
  if (!message) return res.status(400).json({ error: "يجب كتابة نص الرسالة" });

  try {
    // جلب المشتركين من قاعدة البيانات
    const token = await getFirebaseToken();
    const snapRes = await fetch(`${DB_URL}/chat_ids.json?auth=${token}`);
    const chatIdsObj = await snapRes.json();

    if (!chatIdsObj) {
      return res.json({ success: true, sent: 0, message: "لا يوجد مستخدمين بعد" });
    }

    const chatIds = Object.values(chatIdsObj);
    let sent = 0, failed = 0;
    const button = (buttonLabel && buttonUrl) ? { label: buttonLabel, url: buttonUrl, isWebApp: !!isWebApp } : null;

    // إرسال الرسائل
    for (let i = 0; i < chatIds.length; i++) {
      try {
        await sendMessage(chatIds[i], message, button);
        sent++;
      } catch (e) { failed++; }
      // تأخير لتفادي حظر تيليجرام
      if (i % 20 === 19) await new Promise(r => setTimeout(r, 1000));
    }

    return res.json({ success: true, sent, failed, total: chatIds.length });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
