import { getDb } from "./index.js";

export function initializeDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      msrp REAL NOT NULL,
      sku TEXT,
      upc TEXT,
      product_url TEXT,
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_number INTEGER NOT NULL UNIQUE,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      address TEXT NOT NULL,
      zip TEXT,
      distance_miles REAL
    );

    CREATE TABLE IF NOT EXISTS store_deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL REFERENCES stores(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      store_price REAL NOT NULL,
      floor_qty INTEGER NOT NULL DEFAULT 0,
      backroom_qty INTEGER NOT NULL DEFAULT 0,
      aisle TEXT,
      unit_profit REAL NOT NULL,
      is_lowest_price INTEGER NOT NULL DEFAULT 0,
      excluded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(store_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS processed_messages (
      message_id TEXT PRIMARY KEY,
      processed_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      total_profit REAL,
      total_distance REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS route_stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL REFERENCES routes(id),
      store_id INTEGER NOT NULL REFERENCES stores(id),
      stop_order INTEGER NOT NULL,
      profit_at_stop REAL
    );
  `);
}
