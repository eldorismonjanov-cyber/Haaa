const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = 7604718824;
const DB_FILE = path.join(__dirname, "db.json");

const CHANNELS = [
  { url: "https://t.me/+JOyHrW0vxtdmMTdi", label: "📢 Kanal 1" },
  { url: "https://t.me/+f_aSLjftuehhZWJi", label: "📢 Kanal 2" },
  { url: "https://t.me/+0xS6MdMbtUQ2NWEy", label: "📢 Kanal 3" },
  { url: "https://t.me/+1t-UF8R_DoM3NmEy", label: "📢 Kanal 4" },
  { url: "https://t.me/+JPwl5_C42tRhOWIy", label: "📢 Kanal 5" },
];

const BOT_USERNAME = process.env.BOT_USERNAME || "mybot"; // set in Railway vars

// ─── DATABASE ─────────────────────────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getUser(db, userId) {
  if (!db.users[userId]) {
    db.users[userId] = {
      id: userId,
      firstName: "",
      username: "",
      refs: 0,
      joinedAt: Date.now(),
      verified: false,
      referredBy: null,
    };
  }
  return db.users[userId];
}

// ─── BOT INIT ─────────────────────────────────────────────────────────────────
if (!TOKEN) {
  console.error("❌ BOT_TOKEN environment variable is not set!");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
console.log("🤖 Bot ishga tushdi...");

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function isAdmin(userId) {
  return parseInt(userId) === ADMIN_ID;
}

function getRefLink(userId) {
  return `https://t.me/${BOT_USERNAME}?start=ref_${userId}`;
}

function subscribeKeyboard() {
  return {
    inline_keyboard: [
      ...CHANNELS.map((ch) => [{ text: ch.label, url: ch.url }]),
      [{ text: "✅ A'zo bo'ldim!", callback_data: "check_sub" }],
    ],
  };
}

function mainMenu(userId) {
  return {
    inline_keyboard: [
      [{ text: "👥 Mening referal havolam", callback_data: "my_ref" }],
      [{ text: "📊 Statistikam", callback_data: "my_stats" }],
    ],
  };
}

async function sendWelcome(chatId, firstName, userId) {
  const db = loadDB();
  const refLink = getRefLink(userId);
  const user = getUser(db, userId);

  const text =
    `🎉 *Assalomu alaykum, ${firstName}!*\n\n` +
    `💸 *Referal orqali pul ishlashni boshlang!*\n\n` +
    `👥 Har bir do'stingiz uchun: *400 so'm*\n` +
    `💰 Minimal yechish: *4 000 so'm*\n\n` +
    `🔗 *Sizning referal havolangiz:*\n` +
    `\`${refLink}\`\n\n` +
    `_Havolani do'stlaringizga yuboring va daromad qilishni boshlang! 🚀_`;

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: mainMenu(userId),
  });
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const firstName = msg.from.first_name || "Do'st";
  const param = match[1] || "";

  const db = loadDB();
  const user = getUser(db, userId);
  user.firstName = firstName;
  user.username = msg.from.username || "";

  // Handle referral
  if (param.startsWith("ref_")) {
    const referrerId = param.replace("ref_", "");
    if (referrerId !== userId && !user.referredBy && !user.verified) {
      user.referredBy = referrerId;
    }
  }

  saveDB(db);

  if (user.verified) {
    await sendWelcome(chatId, firstName, userId);
    return;
  }

  // Show subscription screen
  const text =
    `👋 *Assalomu alaykum, ${firstName}!*\n\n` +
    `🚀 *Botimizga xush kelibsiz!*\n\n` +
    `💎 Botdan *to'liq foydalanish* uchun quyidagi *5 ta kanalga* a'zo bo'ling:\n\n` +
    `📌 Barcha kanallarga a'zo bo'lgach, *"✅ A'zo bo'ldim!"* tugmasini bosing.\n\n` +
    `_Sizni jamoamizda ko'rishdan xursandmiz! 🎊_`;

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: subscribeKeyboard(),
  });
});

// ─── CALLBACK: check_sub ──────────────────────────────────────────────────────
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = String(query.from.id);
  const firstName = query.from.first_name || "Do'st";
  const data = query.data;

  await bot.answerCallbackQuery(query.id);

  // ── check_sub ──
  if (data === "check_sub") {
    const db = loadDB();
    const user = getUser(db, userId);
    user.firstName = firstName;
    user.username = query.from.username || "";

    if (!user.verified) {
      user.verified = true;

      // Credit referrer
      if (user.referredBy && db.users[user.referredBy]) {
        const referrer = db.users[user.referredBy];
        referrer.refs = (referrer.refs || 0) + 1;

        // Notify referrer
        try {
          const refCount = referrer.refs;
          await bot.sendMessage(
            user.referredBy,
            `🎉 *Qoyil!* Siz orqali yangi odam qo'shildi!\n\n` +
              `👤 +1 odam | Jami: *${refCount}* ta odam\n` +
              `💰 Hisoblangan summa: *${refCount * 400} so'm*`,
            { parse_mode: "Markdown" }
          );
        } catch (e) {
          // referrer may have blocked bot
        }
      }

      saveDB(db);

      // Delete old message
      try {
        await bot.deleteMessage(chatId, query.message.message_id);
      } catch (e) {}

      await sendWelcome(chatId, firstName, userId);
    } else {
      await sendWelcome(chatId, firstName, userId);
    }
    return;
  }

  // ── my_ref ──
  if (data === "my_ref") {
    const refLink = getRefLink(userId);
    const db = loadDB();
    const user = getUser(db, userId);
    const refs = user.refs || 0;
    const earned = refs * 400;

    const text =
      `🔗 *Sizning referal havolangiz:*\n\n` +
      `\`${refLink}\`\n\n` +
      `👥 Jalb qilganlar: *${refs} ta odam*\n` +
      `💰 Hisoblangan: *${earned} so'm*\n\n` +
      `📤 _Havolani do'stlaringizga yuboring va har biri uchun 400 so'm oling!_`;

    await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "back_main" }]],
      },
    });
    return;
  }

  // ── my_stats ──
  if (data === "my_stats") {
    const db = loadDB();
    const user = getUser(db, userId);
    const refs = user.refs || 0;
    const earned = refs * 400;
    const canWithdraw = earned >= 4000;

    const text =
      `📊 *Sizning statistikangiz:*\n\n` +
      `👤 Ism: *${user.firstName}*\n` +
      `🆔 ID: \`${userId}\`\n` +
      `👥 Jalb qilganlar: *${refs} ta*\n` +
      `💰 Hisoblangan summa: *${earned} so'm*\n` +
      `📤 Minimal yechish: *4 000 so'm*\n` +
      `${canWithdraw ? "✅ *Yechish mumkin!*" : `❌ *Yechish uchun ${4000 - earned} so'm yetishmayapti*`}`;

    await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "back_main" }]],
      },
    });
    return;
  }

  // ── back_main ──
  if (data === "back_main") {
    try {
      await bot.deleteMessage(chatId, query.message.message_id);
    } catch (e) {}
    await sendWelcome(chatId, firstName, userId);
    return;
  }
});

// ─── ADMIN: /panel ────────────────────────────────────────────────────────────
bot.onText(/\/panel/, async (msg) => {
  if (!isAdmin(msg.from.id)) return;

  const text =
    `🛠 *Admin Panel*\n\n` +
    `📋 *Mavjud buyruqlar:*\n\n` +
    `👥 \`/odam\` — Botga start bosganlar soni\n\n` +
    `📢 \`/xabar <matn>\` — Barcha foydalanuvchilarga xabar yuborish\n\n` +
    `✏️ \`/setref <user_id> <son>\` — Foydalanuvchi referal sonini belgilash\n` +
    `_Misol: /setref 7272668 5_\n\n` +
    `➕ \`/addref <user_id> <n>\` — Foydalanuvchiga n ta ref qo'shish\n` +
    `_Misol: /addref 7272668 3_\n\n` +
    `🔍 \`/seestats <user_id>\` — Foydalanuvchi statistikasini ko'rish`;

  await bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// ─── ADMIN: /odam ─────────────────────────────────────────────────────────────
bot.onText(/\/odam/, async (msg) => {
  if (!isAdmin(msg.from.id)) return;

  const db = loadDB();
  const total = Object.keys(db.users).length;

  await bot.sendMessage(
    msg.chat.id,
    `📊 *Foydalanuvchilar statistikasi:*\n\n` +
      `👥 Botga start bosganlar: *${total} ta*`,
    { parse_mode: "Markdown" }
  );
});

// ─── ADMIN: /xabar ───────────────────────────────────────────────────────────
bot.onText(/\/xabar (.+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;

  const message = match[1];
  const db = loadDB();
  const userIds = Object.keys(db.users);

  let sent = 0;
  let failed = 0;

  const statusMsg = await bot.sendMessage(
    msg.chat.id,
    `📤 Xabar yuborilmoqda... (0/${userIds.length})`,
    { parse_mode: "Markdown" }
  );

  for (const uid of userIds) {
    try {
      await bot.sendMessage(uid, `📢 *Yangilik:*\n\n${message}`, {
        parse_mode: "Markdown",
      });
      sent++;
    } catch (e) {
      failed++;
    }

    // Update progress every 20 users
    if ((sent + failed) % 20 === 0) {
      try {
        await bot.editMessageText(
          `📤 Xabar yuborilmoqda... (${sent + failed}/${userIds.length})`,
          { chat_id: msg.chat.id, message_id: statusMsg.message_id }
        );
      } catch (e) {}
    }

    await new Promise((r) => setTimeout(r, 50)); // rate limit
  }

  await bot.editMessageText(
    `✅ *Xabar yuborildi!*\n\n` +
      `✔️ Muvaffaqiyatli: *${sent} ta*\n` +
      `❌ Bloklagan/xato: *${failed} ta*`,
    {
      chat_id: msg.chat.id,
      message_id: statusMsg.message_id,
      parse_mode: "Markdown",
    }
  );
});

// ─── ADMIN: /setref ───────────────────────────────────────────────────────────
bot.onText(/\/setref (\d+) (\d+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;

  const targetId = match[1];
  const refCount = parseInt(match[2]);

  const db = loadDB();
  const user = getUser(db, targetId);
  user.refs = refCount;
  saveDB(db);

  await bot.sendMessage(
    msg.chat.id,
    `✅ *Muvaffaqiyatli!*\n\n` +
      `🆔 User ID: \`${targetId}\`\n` +
      `👥 Yangi ref soni: *${refCount} ta*\n` +
      `💰 Hisoblangan: *${refCount * 400} so'm*`,
    { parse_mode: "Markdown" }
  );
});

// ─── ADMIN: /addref ───────────────────────────────────────────────────────────
bot.onText(/\/addref (\d+) (\d+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;

  const targetId = match[1];
  const addCount = parseInt(match[2]);

  const db = loadDB();
  const user = getUser(db, targetId);
  user.refs = (user.refs || 0) + addCount;
  saveDB(db);

  await bot.sendMessage(
    msg.chat.id,
    `✅ *Muvaffaqiyatli qo'shildi!*\n\n` +
      `🆔 User ID: \`${targetId}\`\n` +
      `➕ Qo'shildi: *+${addCount} ta*\n` +
      `👥 Jami ref: *${user.refs} ta*\n` +
      `💰 Hisoblangan: *${user.refs * 400} so'm*`,
    { parse_mode: "Markdown" }
  );
});

// ─── ADMIN: /seestats ─────────────────────────────────────────────────────────
bot.onText(/\/seestats (\d+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;

  const targetId = match[1];
  const db = loadDB();
  const user = db.users[targetId];

  if (!user) {
    await bot.sendMessage(
      msg.chat.id,
      `❌ *Bu ID da foydalanuvchi topilmadi!*\n\`${targetId}\``,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const refs = user.refs || 0;
  const earned = refs * 400;

  await bot.sendMessage(
    msg.chat.id,
    `🔍 *Foydalanuvchi statistikasi:*\n\n` +
      `👤 Ism: *${user.firstName || "Noma'lum"}*\n` +
      `🆔 ID: \`${targetId}\`\n` +
      `📱 Username: ${user.username ? `@${user.username}` : "Yo'q"}\n` +
      `✅ Verified: *${user.verified ? "Ha" : "Yo'q"}*\n` +
      `👥 Jalb qilganlar: *${refs} ta*\n` +
      `💰 Hisoblangan: *${earned} so'm*\n` +
      `📅 Qo'shilgan: *${new Date(user.joinedAt).toLocaleDateString("uz-UZ")}*`,
    { parse_mode: "Markdown" }
  );
});

// ─── ANTI-BYPASS: block unknown commands ──────────────────────────────────────
bot.on("message", async (msg) => {
  const text = msg.text || "";
  const userId = String(msg.from.id);

  // Skip commands (handled above) and non-text
  if (text.startsWith("/")) return;

  const db = loadDB();
  const user = db.users[userId];

  // If not verified, show subscription screen again
  if (!user || !user.verified) {
    const firstName = msg.from.first_name || "Do'st";
    const subText =
      `⚠️ *Botdan foydalanish uchun avval kanallarga a'zo bo'ling!*\n\n` +
      `📌 Quyidagi *5 ta kanalga* a'zo bo'ling va *"✅ A'zo bo'ldim!"* tugmasini bosing.`;

    await bot.sendMessage(msg.chat.id, subText, {
      parse_mode: "Markdown",
      reply_markup: subscribeKeyboard(),
    });
  }
});

// ─── ERROR HANDLING ───────────────────────────────────────────────────────────
bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

console.log("✅ Bot muvaffaqiyatli ishga tushdi!");
