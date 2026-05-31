const BOT_TOKEN  = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const DB_URL     = process.env.FIREBASE_DATABASE_URL;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

// ... (نفس دوال getFirebaseToken و saveUser و callTelegram من الكود السابق بدون تغيير) ...

export default async function handler(req, res) {
  try {
    // رد سريع لمنع التكرار
    res.status(200).end();

    if (req.method !== "POST") return;

    const update = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!update?.message) return;

    const msg    = update.message;
    const chatId = msg.chat.id;
    const text   = msg.text || "";
    const user   = msg.from;
    const name   = user?.first_name || "صديقي";

    if (text.startsWith("/start")) {
      // إرسال رسالة الترحيب الخاصة بأبو حرير
      callTelegram("sendMessage", {
        chat_id: chatId,
        text: `أهلاً وسهلاً ${name}! 🎉\n\nمرحباً بك في بوت *أبو حرير* 🏃‍♂️\n\n⭐ اجمع تقييمات المطاعم\n🎁 أكمل المهام واحصل على مكافآت\n🏆 تصدر قائمة أفضل اللاعبين\n\n👇 اضغط على الزر أدناه للبدء:`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "🎮 العب أبو حرير الآن", web_app: { url: WEBAPP_URL } }
          ]]
        }
      });

      // حفظ المستخدم في قاعدة البيانات لإرسال الرسائل الجماعية لاحقاً
      saveUser(user, chatId).catch(console.error);
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }
}
