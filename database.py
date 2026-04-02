import sqlite3
from werkzeug.security import generate_password_hash

DB_PATH = 'safeher.db'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'user',
        address TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS crimes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        crime_type TEXT NOT NULL,
        description TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        location_name TEXT,
        status TEXT DEFAULT 'pending',
        severity TEXT DEFAULT 'medium',
        attachments TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS sos_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        message TEXT,
        emergency_contacts TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS emergency_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        relationship TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    # Safe migrations — add missing columns to existing DB
    safe_migrations = [
    "ALTER TABLE crimes ADD COLUMN attachments TEXT DEFAULT ''",
    "ALTER TABLE users  ADD COLUMN address TEXT",
    "ALTER TABLE users  ADD COLUMN emergency_contact_name TEXT",
    "ALTER TABLE users  ADD COLUMN emergency_contact_phone TEXT",
    "ALTER TABLE users  ADD COLUMN alternate_phone TEXT",
    "ALTER TABLE users  ADD COLUMN aadhar_number TEXT",
    "ALTER TABLE users  ADD COLUMN current_address TEXT",
    "ALTER TABLE users  ADD COLUMN permanent_address TEXT",
    "ALTER TABLE users  ADD COLUMN contacts_json TEXT DEFAULT '[]'",   # NEW
]
    for sql in safe_migrations:
        try:
            c.execute(sql)
        except Exception:
            pass  # column already exists

    # Default admin
    if not c.execute("SELECT id FROM users WHERE email='admin@safeher.com'").fetchone():
        c.execute("INSERT INTO users (name,email,password,phone,role) VALUES (?,?,?,?,?)",
                  ('Admin','admin@safeher.com', generate_password_hash('admin123'),'9999999999','admin'))

    # Default user
    if not c.execute("SELECT id FROM users WHERE email='user@safeher.com'").fetchone():
        c.execute("INSERT INTO users (name,email,password,phone,role) VALUES (?,?,?,?,?)",
                  ('Demo User','user@safeher.com', generate_password_hash('user123'),'8888888888','user'))

    conn.commit()
    conn.close()