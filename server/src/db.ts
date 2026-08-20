import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { DB_PATH } from './config.js';
import { emptyLedger, type Ledger } from './ledger.js';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS ledger (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    hidden     INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS focus (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    kind         TEXT NOT NULL,
    minutes      REAL NOT NULL,
    completed_at TEXT NOT NULL
  );
`);

/* ---------------------------------------------------------------- ledger */

export function readLedger(): Ledger {
  const row = db.prepare('SELECT data FROM ledger WHERE id = 1').get() as
    | { data: string }
    | undefined;
  if (!row) return emptyLedger();
  // Merge over a fresh default so a ledger written by an older schema still loads.
  return { ...emptyLedger(), ...(JSON.parse(row.data) as Partial<Ledger>) };
}

export function writeLedger(ledger: Ledger): void {
  db.prepare(
    `INSERT INTO ledger (id, data, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(JSON.stringify(ledger), new Date().toISOString());
}

/* -------------------------------------------------------------- messages */

export interface StoredMessage {
  id: number;
  role: 'user' | 'assistant';
  content: Anthropic.ContentBlockParam[] | string;
  /** True for turns that drive the model but are not shown to the learner. */
  hidden: boolean;
  created_at: string;
}

export function readMessages(): StoredMessage[] {
  const rows = db
    .prepare('SELECT id, role, content, hidden, created_at FROM messages ORDER BY id')
    .all() as {
    id: number;
    role: string;
    content: string;
    hidden: number;
    created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    role: r.role as 'user' | 'assistant',
    content: JSON.parse(r.content) as Anthropic.ContentBlockParam[] | string,
    hidden: r.hidden === 1,
    created_at: r.created_at,
  }));
}

export function appendMessage(
  role: 'user' | 'assistant',
  content: Anthropic.ContentBlockParam[] | string,
  hidden = false,
): StoredMessage {
  const created_at = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO messages (role, content, hidden, created_at) VALUES (?, ?, ?, ?)')
    .run(role, JSON.stringify(content), hidden ? 1 : 0, created_at);
  return { id: Number(result.lastInsertRowid), role, content, hidden, created_at };
}

export function messageCount(): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM messages').get() as { n: number };
  return Number(row.n);
}

/** Drop the trailing turn — used to unwind a request that failed mid-stream. */
export function deleteMessagesFrom(id: number): void {
  db.prepare('DELETE FROM messages WHERE id >= ?').run(id);
}

export function resetEverything(): void {
  db.exec('DELETE FROM messages; DELETE FROM ledger; DELETE FROM focus;');
}

/* ----------------------------------------------------------------- focus */

export function logFocus(kind: 'focus' | 'break', minutes: number): void {
  db.prepare('INSERT INTO focus (kind, minutes, completed_at) VALUES (?, ?, ?)').run(
    kind,
    minutes,
    new Date().toISOString(),
  );
}

export interface FocusToday {
  minutes: number;
  pomodoros: number;
}

export function focusToday(): FocusToday {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(minutes), 0) AS minutes, COUNT(*) AS pomodoros
       FROM focus WHERE kind = 'focus' AND completed_at >= ?`,
    )
    .get(since.toISOString()) as { minutes: number; pomodoros: number };
  return { minutes: Math.round(row.minutes), pomodoros: Number(row.pomodoros) };
}

export default db;
