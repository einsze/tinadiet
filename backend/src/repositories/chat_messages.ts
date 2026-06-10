import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import { todayInTimezone } from '../domain/date.js';
import type { ChatMessage, ChatMessageRole } from '../domain/types.js';

const CHAT_MESSAGE_COLUMNS = `
  id, user_id, role, content, date, refused, created_at
`;

type Stmts = {
  insert: Statement;
  findById: Statement;
  listRecentWindow: Statement;
  countQuestionsToday: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    insert: db.prepare(
      `INSERT INTO chat_messages (user_id, role, content, date, refused)
       VALUES (@user_id, @role, @content, @date, @refused)`
    ),
    findById: db.prepare(
      `SELECT ${CHAT_MESSAGE_COLUMNS} FROM chat_messages WHERE id = ?`
    ),
    listRecentWindow: db.prepare(
      `SELECT ${CHAT_MESSAGE_COLUMNS}
       FROM chat_messages
       WHERE user_id = ?
         AND created_at >= datetime('now', ?)
       ORDER BY created_at DESC
       LIMIT ?`
    ),
    countQuestionsToday: db.prepare(
      `SELECT COUNT(*) AS count
       FROM chat_messages
       WHERE user_id = ? AND date = ? AND role = 'user'`
    ),
  };
  return _stmts;
};

type RawChatMessage = Omit<ChatMessage, 'refused'> & { refused: number };

const hydrate = (row: RawChatMessage): ChatMessage => ({
  ...row,
  refused: row.refused === 1,
});

export type ChatMessageAppendInput = {
  user_id: number;
  user_timezone: string;
  role: ChatMessageRole;
  content: string;
  refused: boolean;
};

export const chatMessagesRepository = {
  append: (input: ChatMessageAppendInput): ChatMessage => {
    const s = stmts();
    const date = todayInTimezone(input.user_timezone);
    const info = s.insert.run({
      user_id: input.user_id,
      role: input.role,
      content: input.content,
      date,
      refused: input.refused ? 1 : 0,
    });
    const id = Number(info.lastInsertRowid);
    const row = s.findById.get(id) as RawChatMessage | undefined;
    if (row === undefined) {
      throw new Error(`chatMessagesRepository.append: row ${id} not found`);
    }
    return hydrate(row);
  },

  listRecentWindow: (
    userId: number,
    withinMinutes: number,
    limit: number
  ): ChatMessage[] => {
    const modifier = `-${Math.max(1, Math.floor(withinMinutes))} minutes`;
    const rows = stmts().listRecentWindow.all(
      userId,
      modifier,
      limit
    ) as RawChatMessage[];
    return rows.map(hydrate).reverse();
  },

  countQuestionsToday: (userId: number, date: string): number => {
    const row = stmts().countQuestionsToday.get(userId, date) as {
      count: number;
    };
    return row.count;
  },
};
