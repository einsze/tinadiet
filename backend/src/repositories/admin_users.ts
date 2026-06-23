import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type { AdminRole, AdminUser, AdminUserPublic } from '../domain/types.js';

const COLUMNS = `
  id, email, password_hash, display_name, role, is_active,
  last_login_at, created_by_admin_id, created_at, updated_at
`;

const PUBLIC_COLUMNS = `
  id, email, display_name, role, is_active,
  last_login_at, created_by_admin_id, created_at, updated_at
`;

type Stmts = {
  findById: Statement;
  findByEmail: Statement;
  listAll: Statement;
  insert: Statement;
  updateLastLogin: Statement;
  updatePassword: Statement;
  updateProfile: Statement;
  updateActive: Statement;
  deleteById: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    findById: db.prepare(
      `SELECT ${COLUMNS} FROM admin_users WHERE id = ?`
    ),
    findByEmail: db.prepare(
      `SELECT ${COLUMNS} FROM admin_users WHERE email = ? COLLATE NOCASE`
    ),
    listAll: db.prepare(
      `SELECT ${PUBLIC_COLUMNS} FROM admin_users ORDER BY role DESC, id ASC`
    ),
    insert: db.prepare(
      `INSERT INTO admin_users (email, password_hash, display_name, role, created_by_admin_id)
       VALUES (?, ?, ?, ?, ?)`
    ),
    updateLastLogin: db.prepare(
      `UPDATE admin_users
       SET last_login_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ),
    updatePassword: db.prepare(
      `UPDATE admin_users
       SET password_hash = ?, updated_at = datetime('now')
       WHERE id = ?`
    ),
    updateProfile: db.prepare(
      `UPDATE admin_users
       SET display_name = ?, role = ?, is_active = ?, updated_at = datetime('now')
       WHERE id = ?`
    ),
    updateActive: db.prepare(
      `UPDATE admin_users
       SET is_active = ?, updated_at = datetime('now')
       WHERE id = ?`
    ),
    deleteById: db.prepare(`DELETE FROM admin_users WHERE id = ?`),
  };
  return _stmts;
};

type RawAdminUser = Omit<AdminUser, 'is_active'> & { is_active: number };

const hydrate = (row: RawAdminUser | undefined): AdminUser | undefined => {
  if (row === undefined) return undefined;
  return { ...row, is_active: row.is_active === 1 };
};

const toPublic = (admin: AdminUser): AdminUserPublic => {
  const { password_hash: _password, ...rest } = admin;
  void _password;
  return rest;
};

type RawAdminUserPublic = Omit<AdminUserPublic, 'is_active'> & { is_active: number };

const hydratePublic = (row: RawAdminUserPublic): AdminUserPublic => ({
  ...row,
  is_active: row.is_active === 1,
});

export type AdminUserCreateInput = {
  email: string;
  password_hash: string;
  display_name: string;
  role: AdminRole;
  created_by_admin_id: number | null;
};

export type AdminUserUpdateInput = {
  display_name: string;
  role: AdminRole;
  is_active: boolean;
};

export const adminUsersRepository = {
  findById: (id: number): AdminUser | undefined => {
    return hydrate(stmts().findById.get(id) as RawAdminUser | undefined);
  },

  findByEmail: (email: string): AdminUser | undefined => {
    return hydrate(
      stmts().findByEmail.get(email) as RawAdminUser | undefined
    );
  },

  listAll: (): AdminUserPublic[] => {
    const rows = stmts().listAll.all() as RawAdminUserPublic[];
    return rows.map(hydratePublic);
  },

  toPublic,

  create: (input: AdminUserCreateInput): AdminUser => {
    const info = stmts().insert.run(
      input.email.toLowerCase(),
      input.password_hash,
      input.display_name,
      input.role,
      input.created_by_admin_id
    );
    const id = Number(info.lastInsertRowid);
    const row = stmts().findById.get(id) as RawAdminUser | undefined;
    if (row === undefined) {
      throw new Error(`adminUsersRepository.create: row ${id} not found`);
    }
    return hydrate(row) as AdminUser;
  },

  updateLastLogin: (id: number): void => {
    stmts().updateLastLogin.run(id);
  },

  updatePassword: (id: number, passwordHash: string): AdminUser | undefined => {
    stmts().updatePassword.run(passwordHash, id);
    return hydrate(stmts().findById.get(id) as RawAdminUser | undefined);
  },

  updateProfile: (
    id: number,
    input: AdminUserUpdateInput
  ): AdminUser | undefined => {
    stmts().updateProfile.run(
      input.display_name,
      input.role,
      input.is_active ? 1 : 0,
      id
    );
    return hydrate(stmts().findById.get(id) as RawAdminUser | undefined);
  },

  setActive: (id: number, active: boolean): AdminUser | undefined => {
    stmts().updateActive.run(active ? 1 : 0, id);
    return hydrate(stmts().findById.get(id) as RawAdminUser | undefined);
  },

  deleteById: (id: number): boolean => {
    const info = stmts().deleteById.run(id);
    return info.changes > 0;
  },
};
