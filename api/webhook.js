// api/webhook.js
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
const WEBAPP_URL = process.env.WEBAPP_URL;

module.exports = async (req, res) => {
  // يجب أن نرد على تيليجرام بـ 200 دائماً
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  try {
    const update = req.body;
    if (!update?.message) {
      return res.status(200).send("OK");
    }

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text || "";
    const user = msg.from;
    const name = user?.first_name || "صديقي";

    if (text.startsWith("/start")) {
      // 1. تجهيز وإرسال رسالة الترحيب (ننتظر حتى يتم الإرسال)
      const body = {
        chat_id: chatId,
        text: `أهلاً وسهلاً ${name}! 🎉\n\nمرحباً بك في بوت *أبو حرير* 🏃‍♂️\n\n⭐ اجمع تقييمات المطاعم\n🎁 أكمل المهام واحصل على مكافآت\n🏆 تصدر قائمة أفضل اللاعبين\n\n👇 اضغط على الزر أدناه للبدء:`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "🎮 العب أبو حرير الآن", web_app: { url: WEBAPP_URL } }
          ]]
        }
      };

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ),
      });

      // 2. حفظ بيانات المستخدم في قاعدة البيانات للإرسال الجماعي لاحقاً
      await db.ref(`users/${user.id}`).set({
        chatId: chatId,
        userId: user.id,
        firstName: user.first_name || "",
        username: user.username || "",
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      });

      await db.ref(`chat_ids/${user.id}`).set(chatId);
    }

    // 3. إغلاق الاتصال بنجاح بعد انتهاء كل شيء
    return res.status(200).send("OK");

  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).send("OK");
  }
};
