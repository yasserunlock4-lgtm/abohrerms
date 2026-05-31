// api/broadcast.js
const admin = require("firebase-admin");

// تهيئة الاتصال بقاعدة بيانات Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db = admin.database();
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY;

// دالة إرسال الرسالة لتيليجرام
async function sendMessage(chatId, text, button = null) {
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown",
  };

  // إضافة الزر إذا تم تمرير بياناته من لوحة التحكم
  if (button && button.label && button.url) {
    body.reply_markup = {
      inline_keyboard: [[
        button.isWebApp
          ? { text: button.label, web_app: { url: button.url } }
          : { text: button.label, url: button.url }
      ]]
    };
  }

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ),
  });
  return res.json();
}

module.exports = async (req, res) => {
  // 1. التحقق من المفتاح السري (لحماية البوت من الاختراق)
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: "غير مصرح لك بالوصول" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, buttonLabel, buttonUrl, isWebApp } = req.body;

  if (!message) {
    return res.status(400).json({ error: "يجب كتابة نص الرسالة" });
  }

  try {
    // 2. جلب جميع المشتركين من Firebase
    const snap = await db.ref("chat_ids").get();
    if (!snap.exists()) {
      return res.json({ success: true, sent: 0, message: "لا يوجد مستخدمين بعد" });
    }

    const chatIds = Object.values(snap.val());
    let sent = 0, failed = 0;

    const button = (buttonLabel && buttonUrl)
      ? { label: buttonLabel, url: buttonUrl, isWebApp: !!isWebApp }
      : null;

    // 3. إرسال الرسائل لجميع المشتركين (مع تأخير لتفادي حظر تيليجرام)
    for (let i = 0; i < chatIds.length; i++) {
      try {
        await sendMessage(chatIds[i], message, button);
        sent++;
      } catch (e) {
        failed++;
      }
      // تأخير ثانية واحدة كل 20 رسالة لتجنب الـ Rate Limit
      if (i % 20 === 19) await new Promise(r => setTimeout(r, 1000));
    }

    // 4. إرجاع النتيجة للوحة التحكم
    return res.json({ success: true, sent, failed, total: chatIds.length });

  } catch (err) {
    console.error("Broadcast error:", err);
    return res.status(500).json({ error: err.message });
  }
};
