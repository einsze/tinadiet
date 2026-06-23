import bcrypt from 'bcryptjs';
import { adminUsersRepository } from '../repositories/admin_users.js';
import { issueAdminJwt } from '../auth/admin_session.js';
import type { AdminUser, AdminUserPublic } from '../domain/types.js';

export class AdminAuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_CREDENTIALS'
      | 'INACTIVE'
      | 'NOT_FOUND'
      | 'BAD_PASSWORD'
  ) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

const BCRYPT_COST = 10;

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, BCRYPT_COST);

export const verifyPassword = (
  plain: string,
  hashed: string
): Promise<boolean> => bcrypt.compare(plain, hashed);

export type LoginResult = {
  token: string;
  admin: AdminUserPublic;
};

export const loginAdmin = async (
  email: string,
  password: string
): Promise<LoginResult> => {
  const admin = adminUsersRepository.findByEmail(email.toLowerCase().trim());
  if (admin === undefined) {
    throw new AdminAuthError('Invalid credentials', 'INVALID_CREDENTIALS');
  }
  if (!admin.is_active) {
    throw new AdminAuthError('Admin account is inactive', 'INACTIVE');
  }

  const ok = await verifyPassword(password, admin.password_hash);
  if (!ok) {
    throw new AdminAuthError('Invalid credentials', 'INVALID_CREDENTIALS');
  }

  adminUsersRepository.updateLastLogin(admin.id);

  const token = issueAdminJwt({
    aid: admin.id,
    email: admin.email,
    role: admin.role,
  });

  return { token, admin: adminUsersRepository.toPublic(admin) };
};

export const changeAdminPassword = async (
  admin: AdminUser,
  oldPassword: string,
  newPassword: string
): Promise<void> => {
  if (newPassword.length < 8) {
    throw new AdminAuthError(
      'New password must be at least 8 characters',
      'BAD_PASSWORD'
    );
  }
  const ok = await verifyPassword(oldPassword, admin.password_hash);
  if (!ok) {
    throw new AdminAuthError('Current password is incorrect', 'INVALID_CREDENTIALS');
  }
  const newHash = await hashPassword(newPassword);
  adminUsersRepository.updatePassword(admin.id, newHash);
};
