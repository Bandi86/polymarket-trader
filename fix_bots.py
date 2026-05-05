import sqlite3

db_path = r"D:\bot2\poly6\backend\data\polymarket_v2.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("UPDATE bot_configs SET trading_mode = 'live' WHERE id <= 15")
conn.commit()
print("Mind a 15 bot live módra állítva!")

conn.close()