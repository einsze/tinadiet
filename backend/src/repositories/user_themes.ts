import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type { UserTheme } from '../domain/types.js';

const COLUMNS = `id, user_id, theme_slug, price_credit_snapshot, purchased_at`;

type Stmts = {
  insert: Statement;
  findOwned: Statement;
  listByUser: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    insert: db.prepare(
      `INSERT INTO user_themes (user_id, theme_slug, price_credit_snapshot)
       VALUES (?, ?, ?)`
    ),
    findOwned: db.prepare(
      `SELECT ${COLUMNS} FROM user_themes
       WHERE user_id = ? AND theme_slug = ?`
    ),
    listByUser: db.prepare(
      `SELECT ${COLUMNS} FROM user_themes
       WHERE user_id = ?
       ORDER BY purchased_at ASC`
    ),
  };
  return _stmts;
};

export const userThemesRepository = {
  ownsTheme: (userId: number, themeSlug: string): boolean => {
    return (
      (stmts().findOwned.get(userId, themeSlug) as UserTheme | undefined) !==
      undefined
    );
  },

  listByUser: (userId: number): UserTheme[] => {
    return stmts().listByUser.all(userId) as UserTheme[];
  },

  insert: (
    userId: number,
    themeSlug: string,
    priceCreditSnapshot: number
  ): UserTheme => {
    const info = stmts().insert.run(userId, themeSlug, priceCreditSnapshot);
    const row = stmts().findOwned.get(userId, themeSlug) as UserTheme | undefined;
    if (row === undefined) {
      throw new Error(
        `userThemesRepository.insert: row not found after insert (id=${info.lastInsertRowid})`
      );
    }
    return row;
  },
};
