const BOT_TOKEN  = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const DB_URL     = process.env.FIREBASE_DATABASE_URL;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("OK");

  try {
    const update = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!update?.message) return res.status(200).send("OK");

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text || "";
    const user = msg.from;
    const name = user?.first_name || "صديقي";
    const username = user?.username ? `@${user.username}` : "لا يوجد";

    if (text.startsWith("/start")) {
      // 1. إرسال رسالة الترحيب
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `أهلاً وسهلاً ${name}! 🎉\n\nمرحباً بك في بوت *أبو حرير* 🏃‍♂️\n\n⭐ اجمع تقييمات المطاعم\n🎁 أكمل المهام واحصل على مكافآت\n🏆 تصدر قائمة أفضل اللاعبين\n\n👇 اضغط على الزر أدناه للبدء:`,
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[ { text: "🎮 العب أبو حرير الآن", web_app: { url: WEBAPP_URL } } ]] }
        } )
      });

      // 2. حفظ (الآيدي، الاسم، واليوزر) في مجلد users
      await fetch(`${DB_URL}/users/${chatId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: chatId,
          name: name,
          username: username
        })
      });

      // 3. حفظ الآيدي فقط في مجلد chat_ids (لكي يعمل الإرسال الجماعي بسرعة)
      await fetch(`${DB_URL}/chat_ids/${chatId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatId)
      });
    }
    return res.status(200).send("OK");
  } catch (err) {
    return res.status(200).send("OK");
  }
}
