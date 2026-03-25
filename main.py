import os
import asyncio
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import CommandStart, Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ChatJoinRequest
from aiogram.utils.deep_linking import create_start_link, decode_payload
import database as db

# Railway Variables'dan olinadi
BOT_TOKEN = os.getenv("BOT_TOKEN") 
ADMIN_ID = 7604718824
REQUIRED_CHANNELS = 5

bot = Bot(token=BOT_TOKEN, parse_mode="HTML")
dp = Dispatcher()

def get_channels_keyboard():
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📢 1-Kanalga a'zo bo'lish", url="https://t.me/+JOyHrW0vxtdmMTdi")],
        [InlineKeyboardButton(text="📢 2-Kanalga a'zo bo'lish", url="https://t.me/+f_aSLjftuehhZWJi")],
        [InlineKeyboardButton(text="📢 3-Kanalga a'zo bo'lish", url="https://t.me/+0xS6MdMbtUQ2NWEy")],
        [InlineKeyboardButton(text="📢 4-Kanalga a'zo bo'lish", url="https://t.me/+1t-UF8R_DoM3NmEy")],
        [InlineKeyboardButton(text="📢 5-Kanalga a'zo bo'lish", url="https://t.me/+JPwl5_C42tRhOWIy")],
        [InlineKeyboardButton(text="✅ A'zo bo'ldim", callback_data="check_requests")]
    ])
    return keyboard

@dp.message(CommandStart())
async def start_handler(message: types.Message):
    user_id = message.from_user.id
    
    # Referal ID ni aniqlash
    referrer_id = None
    if " " in message.text:
        payload = message.text.split(" ")[1]
        try:
            referrer_id = int(decode_payload(payload))
        except:
            pass

    # Yangi foydalanuvchini bazaga qo'shish
    await db.add_user(user_id, referrer_id if referrer_id != user_id else None)
    
    # Tekshirish paneli
    text = (
        "🚀 <b>Xush kelibsiz! Botdan to'liq foydalanish uchun quyidagi kanallarga qo'shilish so'rovini yuboring.</b>\n\n"
        "<i>💎 Bu Vaelux va hamkorlar tarmog'i bo'lib, eng sifatli loyihalarni taqdim etadi. Barcha kanallarga so'rov yuborgach, «✅ A'zo bo'ldim» tugmasini bosing!</i>"
    )
    await message.answer(text, reply_markup=get_channels_keyboard())

# --- REQUEST USHLAGICH ---
@dp.chat_join_request()
async def handle_join_request(update: ChatJoinRequest):
    # So'rovni bazaga yozamiz
    await db.log_join_request(update.from_user.id, update.chat.id)
    # So'rovni avtomatik tasdiqlash
    try:
        await bot.approve_chat_join_request(update.chat.id, update.from_user.id)
    except Exception as e:
        print(f"Tasdiqlashda xatolik: {e}")

@dp.callback_query(F.data == "check_requests")
async def check_subs(call: types.CallbackQuery):
    user_id = call.from_user.id
    req_count = await db.get_user_request_count(user_id)
    
    if req_count >= REQUIRED_CHANNELS:
        await call.message.delete()
        
        # Referal egasiga xabar yuborish (agar foydalanuvchi birinchi marta o'tgan bo'lsa)
        user_data = await db.get_user(user_id)
        if user_data and user_data[2]: # referrer_id mavjud bo'lsa
            ref_id = user_data[2]
            await db.add_referral(ref_id)
            ref_data = await db.get_user(ref_id)
            if ref_data:
                try:
                    await bot.send_message(
                        ref_id, 
                        f"🎉 <b>Qoyil!</b> Sizning havolangiz orqali +1 odam qo'shildi!\n"
                        f"📈 <b>Jami taklif qilinganlar:</b> {ref_data[1]} ta."
                    )
                except:
                    pass
        
        # Foydalanuvchining o'ziga referal link berish
        ref_link = await create_start_link(bot, str(user_id), encode=True)
        first_name = call.from_user.first_name
        
        main_text = (
            f"👋 <b>Assalomu alaykum, {first_name}!</b>\n\n"
            f"🎯 <b>Referral orqali barqaror daromad qilishni boshlang!</b>\n"
            f"Har bir taklif qilingan faol do'stingiz uchun sizga <b>400 so'm</b> taqdim etiladi.\n"
            f"💳 <i>Minimal pul yechish miqdori: 4000 so'm</i>\n\n"
            f"🔗 <b>Sizning shaxsiy marketing havolangiz:</b>\n{ref_link}\n\n"
            f"<i>🚀 Havolani do'stlaringizga ulashing va natijalarni kuzatib boring!</i>"
        )
        await call.message.answer(main_text)
    else:
        await call.answer("❌ Siz barcha kanallarga so'rov yubormadingiz! Iltimos, barchasiga qo'shilish so'rovini yuboring.", show_alert=True)

# --- ADMIN PANEL ---
@dp.message(Command("panel"))
async def admin_panel(message: types.Message):
    if message.from_user.id != ADMIN_ID:
        return
    text = (
        "👑 <b>Admin Boshqaruv Paneli</b>\n\n"
        "📊 /odam - <i>Botdagi umumiy foydalanuvchilar soni</i>\n"
        "📢 /xabar <matn> - <i>Barcha foydalanuvchilarga xabar tarqatish</i>\n"
        "✍️ /setref <user_id> <soni> - <i>Foydalanuvchining referal sonini o'rnatish</i>\n"
        "➕ /addref <user_id> <soni> - <i>Foydalanuvchiga referal qo'shish</i>\n"
        "🔍 /seestats <user_id> - <i>Foydalanuvchi statistikasini ko'rish</i>"
    )
    await message.answer(text)

@dp.message(Command("odam"))
async def admin_odam(message: types.Message):
    if message.from_user.id != ADMIN_ID:
        return
    users = await db.get_all_users()
    await message.answer(f"👥 <b>Umumiy foydalanuvchilar soni:</b> {len(users)} ta")

@dp.message(Command("xabar"))
async def admin_xabar(message: types.Message):
    if message.from_user.id != ADMIN_ID:
        return
    text_to_send = message.text.replace("/xabar", "", 1).strip()
    if not text_to_send:
        await message.answer("⚠️ Xabar matnini kiriting. Masalan: <code>/xabar Salom hammaga!</code>")
        return
    
    users = await db.get_all_users()
    sent_count = 0
    await message.answer("⏳ <i>Xabar tarqatish boshlandi...</i>")
    
    for (uid,) in users:
        try:
            await bot.send_message(uid, text_to_send)
            sent_count += 1
            await asyncio.sleep(0.05) # Telegram limitlaridan himoya
        except:
            pass
            
    await message.answer(f"✅ <b>Xabar muvaffaqiyatli yuborildi!</b>\nQabul qildi: {sent_count} ta foydalanuvchi.")

@dp.message(Command("setref"))
async def admin_setref(message: types.Message):
    if message.from_user.id != ADMIN_ID:
        return
    try:
        args = message.text.split()
        target_id = int(args[1])
        ref_count = int(args[2])
        await db.update_referral_stats(target_id, ref_count, "set")
        await message.answer(f"✅ ID: {target_id} uchun referallar soni <b>{ref_count}</b> etib belgilandi.")
    except Exception:
        await message.answer("⚠️ Xato format! To'g'ri foydalanish: <code>/setref 7272668 5</code>")

@dp.message(Command("addref"))
async def admin_addref(message: types.Message):
    if message.from_user.id != ADMIN_ID:
        return
    try:
        args = message.text.split()
        target_id = int(args[1])
        ref_count = int(args[2])
        await db.update_referral_stats(target_id, ref_count, "add")
        await message.answer(f"✅ ID: {target_id} ga <b>{ref_count}</b> ta referal qo'shildi.")
    except Exception:
        await message.answer("⚠️ Xato format! To'g'ri foydalanish: <code>/addref 7272668 5</code>")

@dp.message(Command("seestats"))
async def admin_seestats(message: types.Message):
    if message.from_user.id != ADMIN_ID:
        return
    try:
        target_id = int(message.text.split()[1])
        user_data = await db.get_user(target_id)
        if user_data:
            balance, refs, _ = user_data
            await message.answer(f"👤 <b>Foydalanuvchi:</b> {target_id}\n👥 <b>Referallar:</b> {refs} ta\n💰 <b>Balans:</b> {balance} so'm")
        else:
            await message.answer("❌ Bu foydalanuvchi bazada topilmadi.")
    except Exception:
        await message.answer("⚠️ Xato format! To'g'ri foydalanish: <code>/seestats 7272668</code>")

async def main():
    await db.init_db()
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
