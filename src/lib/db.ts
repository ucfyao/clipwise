import Database from "better-sqlite3";
import { DB_PATH } from "./constants";

// Use globalThis to survive Next.js HMR in dev mode
const g = globalThis as typeof globalThis & { __clipwise_db?: Database.Database };

export function getDb(): Database.Database {
  if (!g.__clipwise_db) {
    g.__clipwise_db = new Database(DB_PATH);
    g.__clipwise_db.pragma("journal_mode = WAL");
    g.__clipwise_db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'both',
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER NOT NULL DEFAULT 0,
        current_step TEXT NOT NULL DEFAULT '',
        config TEXT NOT NULL DEFAULT '{}',
        result TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
  return g.__clipwise_db;
}
