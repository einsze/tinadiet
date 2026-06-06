import Database, { type Database as Db } from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { env } from '../config/env.js';

const parseDatabaseUrl = (url: string): string => {
  if (!url.startsWith('file:')) {
    throw new Error(`Only file: scheme supported in DATABASE_URL, got: ${url}`);
  }
  const raw = url.slice('file:'.length);
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
};

const DB_FILE = parseDatabaseUrl(env.DATABASE_URL);
mkdirSync(dirname(DB_FILE), { recursive: true });

export const db: Db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export const dbFilePath = DB_FILE;
