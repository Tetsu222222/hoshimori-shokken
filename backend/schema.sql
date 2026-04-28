DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS global_settings;

CREATE TABLE global_settings (
  cafeteria_name TEXT DEFAULT '星の杜食堂',
  admin_password TEXT DEFAULT 'admin'
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  event_name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  venue TEXT,
  start_time TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  end_time TEXT NOT NULL,
  classes TEXT NOT NULL,
  explanation_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  class_name TEXT NOT NULL,
  child_name TEXT NOT NULL,
  ticket_number INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events (id)
);

INSERT INTO global_settings (cafeteria_name, admin_password) VALUES ('星の杜食堂', 'admin');

CREATE TABLE IF NOT EXISTS urls (
  short_code TEXT PRIMARY KEY,
  original_url TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
