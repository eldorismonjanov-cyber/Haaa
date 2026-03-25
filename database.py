import aiosqlite

DB_NAME = "bot_data.db"

async def init_db():
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                referrer_id INTEGER,
                balance INTEGER DEFAULT 0,
                referrals_count INTEGER DEFAULT 0
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS join_requests (
                user_id INTEGER,
                chat_id INTEGER,
                UNIQUE(user_id, chat_id)
            )
        """)
        await db.commit()

async def add_user(user_id: int, referrer_id: int = None):
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT user_id FROM users WHERE user_id = ?", (user_id,)) as cursor:
            if not await cursor.fetchone():
                await db.execute("INSERT INTO users (user_id, referrer_id) VALUES (?, ?)", (user_id, referrer_id))
                await db.commit()
                return True
        return False

async def log_join_request(user_id: int, chat_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("INSERT OR IGNORE INTO join_requests (user_id, chat_id) VALUES (?, ?)", (user_id, chat_id))
        await db.commit()

async def get_user_request_count(user_id: int) -> int:
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT COUNT(*) FROM join_requests WHERE user_id = ?", (user_id,)) as cursor:
            result = await cursor.fetchone()
            return result[0] if result else 0

async def add_referral(referrer_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("UPDATE users SET referrals_count = referrals_count + 1, balance = balance + 400 WHERE user_id = ?", (referrer_id,))
        await db.commit()

async def get_user(user_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT balance, referrals_count, referrer_id FROM users WHERE user_id = ?", (user_id,)) as cursor:
            return await cursor.fetchone()

async def get_all_users():
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT user_id FROM users") as cursor:
            return await cursor.fetchall()

async def update_referral_stats(user_id: int, count: int, mode: str = "set"):
    async with aiosqlite.connect(DB_NAME) as db:
        if mode == "set":
            await db.execute("UPDATE users SET referrals_count = ?, balance = ? * 400 WHERE user_id = ?", (count, count, user_id))
        elif mode == "add":
            await db.execute("UPDATE users SET referrals_count = referrals_count + ?, balance = balance + (? * 400) WHERE user_id = ?", (count, count, user_id))
        await db.commit()
