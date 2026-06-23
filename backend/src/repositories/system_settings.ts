import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type { SystemSetting, SystemSettingKey } from '../domain/types.js';

const COLUMNS = `key, value, updated_by_admin_id, updated_at`;

type Stmts = {
  get: Statement;
  all: Statement;
  upsert: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    get: db.prepare(
      `SELECT ${COLUMNS} FROM system_settings WHERE key = ?`
    ),
    all: db.prepare(
      `SELECT ${COLUMNS} FROM system_settings ORDER BY key ASC`
    ),
    upsert: db.prepare(
      `INSERT INTO system_settings (key, value, updated_by_admin_id, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_by_admin_id = excluded.updated_by_admin_id,
         updated_at = datetime('now')`
    ),
  };
  return _stmts;
};

export const systemSettingsRepository = {
  get: (key: SystemSettingKey): SystemSetting | undefined => {
    return stmts().get.get(key) as SystemSetting | undefined;
  },

  getString: (key: SystemSettingKey, fallback = ''): string => {
    const row = stmts().get.get(key) as SystemSetting | undefined;
    return row?.value ?? fallback;
  },

  getNumber: (key: SystemSettingKey, fallback = 0): number => {
    const row = stmts().get.get(key) as SystemSetting | undefined;
    if (row === undefined) return fallback;
    const n = Number(row.value);
    return Number.isFinite(n) ? n : fallback;
  },

  all: (): SystemSetting[] => {
    return stmts().all.all() as SystemSetting[];
  },

  set: (
    key: SystemSettingKey,
    value: string,
    updatedByAdminId: number | null
  ): SystemSetting => {
    stmts().upsert.run(key, value, updatedByAdminId);
    const row = stmts().get.get(key) as SystemSetting | undefined;
    if (row === undefined) {
      throw new Error(`systemSettingsRepository.set: key ${key} not found after upsert`);
    }
    return row;
  },
};
