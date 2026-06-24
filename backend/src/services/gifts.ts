import { randomBytes } from 'crypto';
import { db } from '../db/sqlite.js';
import { env } from '../config/env.js';
import { giftsRepository } from '../repositories/gifts.js';
import { userRepository } from '../repositories/users.js';
import { userThemesRepository } from '../repositories/user_themes.js';
import { lineClient } from '../line/client.js';
import { spendCredit, grantCredit } from './credit.js';
import {
  ALL_BUNDLES,
  getBundlePriceCredit,
  type PremiumBundle,
} from './premium_redemption.js';
import {
  getThemePriceCredit,
  isValidThemeSlug,
  requireTheme,
  DEFAULT_THEME_SLUG,
} from './themes.js';
import type {
  Gift,
  GiftPayload,
  GiftPremiumPayload,
  GiftRefusedReason,
  GiftThemePayload,
  GiftType,
  User,
} from '../domain/types.js';

export class GiftError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_GIFT_TYPE'
      | 'INVALID_PAYLOAD'
      | 'USER_NOT_FOUND'
      | 'BLOCKED'
      | 'PENDING_CAP_REACHED'
      | 'MESSAGE_TOO_LONG'
      | 'INSUFFICIENT_CREDIT'
      | 'GIFT_NOT_FOUND'
      | 'GIFT_NOT_PENDING'
      | 'GIFT_NOT_CLAIMED'
      | 'GIFT_EXPIRED'
      | 'NOT_OWNER'
      | 'PRICE_NOT_CONFIGURED'
      | 'SELF_CLAIM'
      | 'RECIPIENT_BLOCKED'
      | 'RECIPIENT_ALREADY_OWNS_THEME'
  ) {
    super(message);
    this.name = 'GiftError';
  }
}

const generateClaimToken = (): string =>
  randomBytes(16).toString('base64url'); // 22 chars, 128 bits entropy

const computeExpiryIso = (now: Date): string => {
  const ms = now.getTime() + env.GIFT_CLAIM_WINDOW_DAYS * 86400 * 1000;
  return new Date(ms).toISOString();
};

const monthsToApproxMs = (months: number): number =>
  months * 30 * 86400 * 1000;

export type CreateGiftInput = {
  sender_user_id: number;
  gift_type: GiftType;
  payload: GiftPayload;
  message: string | null;
};

export type CreateGiftResult = {
  gift: Gift;
  credit_balance_satang: number;
  claim_url: string;
};

const validatePayload = (
  gift_type: GiftType,
  payload: GiftPayload
): { priceCredit: number } => {
  if (gift_type === 'premium') {
    const p = payload as GiftPremiumPayload;
    if (
      !ALL_BUNDLES.includes(p.months as PremiumBundle) ||
      ![1, 3, 6, 12].includes(p.months)
    ) {
      throw new GiftError(
        `Premium gift months must be 1, 3, 6, or 12`,
        'INVALID_PAYLOAD'
      );
    }
    try {
      return { priceCredit: getBundlePriceCredit(p.months as PremiumBundle) };
    } catch {
      throw new GiftError(
        `Premium bundle ${p.months} months price not configured`,
        'PRICE_NOT_CONFIGURED'
      );
    }
  }
  if (gift_type === 'theme') {
    const p = payload as GiftThemePayload;
    if (!isValidThemeSlug(p.theme_slug)) {
      throw new GiftError(`Unknown theme: ${p.theme_slug}`, 'INVALID_PAYLOAD');
    }
    const theme = requireTheme(p.theme_slug);
    if (theme.is_default) {
      throw new GiftError(
        `Cannot gift the free default theme`,
        'INVALID_PAYLOAD'
      );
    }
    try {
      return { priceCredit: getThemePriceCredit(p.theme_slug) };
    } catch {
      throw new GiftError(
        `Theme ${p.theme_slug} price not configured`,
        'PRICE_NOT_CONFIGURED'
      );
    }
  }
  throw new GiftError(`Unknown gift_type: ${gift_type}`, 'INVALID_GIFT_TYPE');
};

const buildClaimUrl = (token: string): string => {
  // Use LIFF deep link form so LINE auto-opens the LIFF webview (with auth
  // context + ID token available). Direct app.tinadiet.com URLs open LINE's
  // generic smart browser instead, which has no LIFF context and fails auth.
  if (env.LIFF_ID.length > 0) {
    return `https://liff.line.me/${env.LIFF_ID}/claim/${token}`;
  }
  const base = env.LIFF_URL.replace(/\/$/, '');
  return `${base}/claim/${token}`;
};

/**
 * Create a gift: atomically debits credit from sender, persists the gift row,
 * returns claim URL. Sender's credit_balance is reduced immediately so the
 * claim link is backed by escrow. Refund happens on cancel / expire / refused.
 */
export const createGift = (input: CreateGiftInput): CreateGiftResult => {
  const message = input.message?.trim() ?? null;
  if (message !== null && message.length > env.GIFT_MESSAGE_MAX_LENGTH) {
    throw new GiftError(
      `Message exceeds ${env.GIFT_MESSAGE_MAX_LENGTH} chars`,
      'MESSAGE_TOO_LONG'
    );
  }

  const sender = userRepository.findById(input.sender_user_id);
  if (sender === undefined) {
    throw new GiftError(
      `Sender ${input.sender_user_id} not found`,
      'USER_NOT_FOUND'
    );
  }
  if (sender.is_blocked) {
    throw new GiftError('Sender account is blocked', 'BLOCKED');
  }
  if (sender.abuse_warning_count > 0) {
    throw new GiftError(
      'Akun Anda sedang dalam review, transfer hadiah dinonaktifkan sementara',
      'BLOCKED'
    );
  }

  const pendingCount = giftsRepository.countPendingBySender(sender.id);
  if (pendingCount >= env.GIFT_MAX_PENDING_PER_SENDER) {
    throw new GiftError(
      `Maximum ${env.GIFT_MAX_PENDING_PER_SENDER} pending gifts at a time. ` +
        `Batalkan salah satu hadiah pending terlebih dahulu.`,
      'PENDING_CAP_REACHED'
    );
  }

  const { priceCredit } = validatePayload(input.gift_type, input.payload);
  const priceSatang = priceCredit * 100;
  if (sender.credit_balance_satang < priceSatang) {
    throw new GiftError(
      `Insufficient credit: have ${sender.credit_balance_satang / 100}, ` +
        `need ${priceCredit}`,
      'INSUFFICIENT_CREDIT'
    );
  }

  const now = new Date();
  const token = generateClaimToken();

  const tx = db.transaction(() => {
    const gift = giftsRepository.create({
      claim_token: token,
      sender_user_id: sender.id,
      gift_type: input.gift_type,
      payload: JSON.stringify(input.payload),
      credit_spent_satang: priceSatang,
      message,
      claim_expires_at: computeExpiryIso(now),
    });
    const mutation = spendCredit({
      user_id: sender.id,
      amount_satang: priceSatang,
      source_type: 'gift_send',
      source_ref_id: gift.id,
      admin_user_id: null,
      note: `Gift ${input.gift_type} (id=${gift.id})`,
    });
    return { gift, credit_balance_satang: mutation.user.credit_balance_satang };
  });

  const result = tx();
  return {
    gift: result.gift,
    credit_balance_satang: result.credit_balance_satang,
    claim_url: buildClaimUrl(result.gift.claim_token),
  };
};

/**
 * Sender cancels their own pending gift. Atomic refund + status update.
 */
export const cancelGift = (
  giftId: number,
  senderUserId: number
): { gift: Gift; credit_balance_satang: number } => {
  const gift = giftsRepository.findById(giftId);
  if (gift === undefined) {
    throw new GiftError(`Gift ${giftId} not found`, 'GIFT_NOT_FOUND');
  }
  if (gift.sender_user_id !== senderUserId) {
    throw new GiftError('Not the gift owner', 'NOT_OWNER');
  }
  if (gift.status !== 'pending') {
    throw new GiftError(
      `Gift is ${gift.status}, only pending gifts can be canceled`,
      'GIFT_NOT_PENDING'
    );
  }

  const tx = db.transaction(() => {
    const updated = giftsRepository.markCanceled(gift.id, senderUserId);
    if (!updated) {
      throw new GiftError(
        'Failed to cancel gift (race?)',
        'GIFT_NOT_PENDING'
      );
    }
    const mutation = grantCredit({
      user_id: senderUserId,
      amount_satang: gift.credit_spent_satang,
      source_type: 'gift_refund',
      source_ref_id: gift.id,
      admin_user_id: null,
      note: `Gift canceled by sender (id=${gift.id})`,
    });
    const fresh = giftsRepository.findById(gift.id);
    if (fresh === undefined) {
      throw new GiftError('Gift vanished after cancel', 'GIFT_NOT_FOUND');
    }
    return {
      gift: fresh,
      credit_balance_satang: mutation.user.credit_balance_satang,
    };
  });

  return tx();
};

export const parseGiftPayload = (gift: Gift): GiftPayload => {
  return JSON.parse(gift.payload) as GiftPayload;
};

/**
 * Attempt to claim a gift on behalf of an authenticated user. Several paths:
 * - happy: status='pending', valid → mark claimed, apply entitlement
 * - expired window: mark expired, refund sender, throw EXPIRED
 * - self: mark refused, refund sender, throw SELF_CLAIM
 * - blocked recipient: mark refused, refund sender, throw RECIPIENT_BLOCKED
 * - already owns theme: mark refused, refund sender, throw RECIPIENT_ALREADY_OWNS_THEME
 */
export type ClaimResult = {
  gift: Gift;
  recipient: User;
};

const refuseAndRefund = (gift: Gift, reason: GiftRefusedReason): void => {
  db.transaction(() => {
    const ok = giftsRepository.markRefused(gift.id, reason);
    if (!ok) return; // race: someone else handled
    grantCredit({
      user_id: gift.sender_user_id,
      amount_satang: gift.credit_spent_satang,
      source_type: 'gift_refund',
      source_ref_id: gift.id,
      admin_user_id: null,
      note: `Gift refused: ${reason} (id=${gift.id})`,
    });
  })();
};

const expireAndRefund = (gift: Gift): void => {
  db.transaction(() => {
    const ok = giftsRepository.markExpired(gift.id);
    if (!ok) return;
    grantCredit({
      user_id: gift.sender_user_id,
      amount_satang: gift.credit_spent_satang,
      source_type: 'gift_refund',
      source_ref_id: gift.id,
      admin_user_id: null,
      note: `Gift expired (id=${gift.id})`,
    });
  })();
};

export const claimGift = (
  token: string,
  claimerUserId: number
): ClaimResult => {
  const gift = giftsRepository.findByToken(token);
  if (gift === undefined) {
    throw new GiftError(`Gift token not found`, 'GIFT_NOT_FOUND');
  }
  if (gift.status !== 'pending') {
    throw new GiftError(
      `Gift is ${gift.status}`,
      gift.status === 'expired' ? 'GIFT_EXPIRED' : 'GIFT_NOT_PENDING'
    );
  }
  const now = new Date();
  if (new Date(gift.claim_expires_at).getTime() <= now.getTime()) {
    expireAndRefund(gift);
    throw new GiftError(`Gift expired`, 'GIFT_EXPIRED');
  }
  if (gift.sender_user_id === claimerUserId) {
    refuseAndRefund(gift, 'self_claim');
    throw new GiftError(`Cannot claim your own gift`, 'SELF_CLAIM');
  }
  const recipient = userRepository.findById(claimerUserId);
  if (recipient === undefined) {
    throw new GiftError(`Claimer ${claimerUserId} not found`, 'USER_NOT_FOUND');
  }
  if (recipient.is_blocked) {
    refuseAndRefund(gift, 'recipient_blocked');
    throw new GiftError(`Recipient account is blocked`, 'RECIPIENT_BLOCKED');
  }

  const payload = parseGiftPayload(gift);

  if (gift.gift_type === 'theme') {
    const themePayload = payload as GiftThemePayload;
    if (
      userThemesRepository.ownsTheme(recipient.id, themePayload.theme_slug)
    ) {
      refuseAndRefund(gift, 'recipient_already_owns_theme');
      throw new GiftError(
        `Recipient already owns theme ${themePayload.theme_slug}`,
        'RECIPIENT_ALREADY_OWNS_THEME'
      );
    }

    const tx = db.transaction(() => {
      const owned = userThemesRepository.insert(
        recipient.id,
        themePayload.theme_slug,
        0 // gift theme: price snapshot = 0 (paid by sender, not recipient)
      );
      const updatedUser = userRepository.setActiveTheme(
        recipient.id,
        themePayload.theme_slug
      );
      const ok = giftsRepository.markClaimed({
        id: gift.id,
        recipient_user_id: recipient.id,
        applied_premium_ms_added: null,
        applied_theme_slug: themePayload.theme_slug,
      });
      if (!ok) {
        throw new GiftError(
          'Failed to mark gift claimed (race?)',
          'GIFT_NOT_PENDING'
        );
      }
      return {
        gift_id: gift.id,
        owned_id: owned.id,
        user: updatedUser ?? recipient,
      };
    });
    const txResult = tx();
    const finalGift = giftsRepository.findById(txResult.gift_id);
    if (finalGift === undefined)
      throw new GiftError('Gift vanished after claim', 'GIFT_NOT_FOUND');
    return { gift: finalGift, recipient: txResult.user };
  }

  // premium
  const premiumPayload = payload as GiftPremiumPayload;
  const months = premiumPayload.months;
  const previousExpiryMs =
    recipient.premium_expires_at !== null
      ? new Date(recipient.premium_expires_at).getTime()
      : 0;
  const baseMs = Math.max(previousExpiryMs, now.getTime());
  const newExpiryDate = new Date(baseMs);
  newExpiryDate.setUTCMonth(newExpiryDate.getUTCMonth() + months);
  const newExpiryIso = newExpiryDate.toISOString();
  const msAdded = newExpiryDate.getTime() - baseMs;
  // approximate fallback if month math gives weird drift
  const safeMsAdded = msAdded > 0 ? msAdded : monthsToApproxMs(months);

  const tx = db.transaction(() => {
    const updatedUser = userRepository.applyPremium(recipient.id, newExpiryIso);
    const ok = giftsRepository.markClaimed({
      id: gift.id,
      recipient_user_id: recipient.id,
      applied_premium_ms_added: safeMsAdded,
      applied_theme_slug: null,
    });
    if (!ok) {
      throw new GiftError(
        'Failed to mark gift claimed (race?)',
        'GIFT_NOT_PENDING'
      );
    }
    return { user: updatedUser ?? recipient };
  });
  const txResult = tx();
  const finalGift = giftsRepository.findById(gift.id);
  if (finalGift === undefined)
    throw new GiftError('Gift vanished after claim', 'GIFT_NOT_FOUND');
  return { gift: finalGift, recipient: txResult.user };
};

/**
 * Admin revokes a claimed gift: refunds sender + unwinds recipient's entitlement.
 */
export type RevokeGiftResult = {
  gift: Gift;
  sender_new_balance_satang: number;
};

export const revokeGift = (
  giftId: number,
  adminUserId: number,
  reason: string
): RevokeGiftResult => {
  const gift = giftsRepository.findById(giftId);
  if (gift === undefined) {
    throw new GiftError(`Gift ${giftId} not found`, 'GIFT_NOT_FOUND');
  }
  if (gift.status !== 'claimed') {
    throw new GiftError(
      `Gift is ${gift.status}, only claimed gifts can be revoked`,
      'GIFT_NOT_CLAIMED'
    );
  }
  const trimmedReason = reason.trim();
  if (trimmedReason.length === 0) {
    throw new GiftError('Revoke reason is required', 'INVALID_PAYLOAD');
  }

  const tx = db.transaction(() => {
    // Unwind recipient's entitlement first
    if (gift.recipient_user_id !== null) {
      const recipient = userRepository.findById(gift.recipient_user_id);
      if (recipient !== undefined) {
        if (gift.gift_type === 'theme' && gift.applied_theme_slug !== null) {
          // Remove ownership; if active, revert to default.
          db.prepare(
            `DELETE FROM user_themes WHERE user_id = ? AND theme_slug = ?`
          ).run(recipient.id, gift.applied_theme_slug);
          if (recipient.active_theme_slug === gift.applied_theme_slug) {
            userRepository.setActiveTheme(recipient.id, null);
          }
        } else if (
          gift.gift_type === 'premium' &&
          gift.applied_premium_ms_added !== null &&
          recipient.premium_expires_at !== null
        ) {
          const currentExpiryMs = new Date(
            recipient.premium_expires_at
          ).getTime();
          const newMs = currentExpiryMs - gift.applied_premium_ms_added;
          const now = Date.now();
          if (newMs > now) {
            userRepository.setPremiumExpiresAt(
              recipient.id,
              new Date(newMs).toISOString()
            );
          } else {
            userRepository.revertToFree(recipient.id);
          }
        }
      }
    }
    // Refund sender
    const refund = grantCredit({
      user_id: gift.sender_user_id,
      amount_satang: gift.credit_spent_satang,
      source_type: 'gift_refund',
      source_ref_id: gift.id,
      admin_user_id: adminUserId,
      note: `Gift revoked by admin: ${trimmedReason} (id=${gift.id})`,
    });
    const ok = giftsRepository.markRevoked({
      id: gift.id,
      revoked_by_admin_id: adminUserId,
      revoke_reason: trimmedReason,
    });
    if (!ok) {
      throw new GiftError(
        'Failed to mark gift revoked',
        'GIFT_NOT_CLAIMED'
      );
    }
    return { sender_new_balance_satang: refund.user.credit_balance_satang };
  });

  const txResult = tx();
  const finalGift = giftsRepository.findById(gift.id);
  if (finalGift === undefined)
    throw new GiftError('Gift vanished after revoke', 'GIFT_NOT_FOUND');
  return {
    gift: finalGift,
    sender_new_balance_satang: txResult.sender_new_balance_satang,
  };
};

/**
 * Fire-and-forget LINE push helpers. Failures logged but never throw.
 */
const safePush = async (
  lineUserId: string,
  text: string,
  context: string
): Promise<void> => {
  try {
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text }],
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'gifts.push_failed',
        context,
        line_user_id: lineUserId,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }
};

const describeGift = (gift: Gift): string => {
  const payload = parseGiftPayload(gift);
  if (gift.gift_type === 'premium') {
    return `Premium ${(payload as GiftPremiumPayload).months} เดือน`;
  }
  return `theme ${(payload as GiftThemePayload).theme_slug}`;
};

export const notifyGiftClaimed = async (
  gift: Gift,
  recipient: User
): Promise<void> => {
  const sender = userRepository.findById(gift.sender_user_id);
  if (!sender) return;
  const text = [
    '🎁 หัตถ์การให้',
    '',
    `${recipient.display_name ?? 'เพื่อน'} ได้รับ${describeGift(gift)}`,
    `ที่คุณส่งให้แล้วค่ะ`,
  ].join('\n');
  await safePush(sender.line_user_id, text, 'gift_claimed');
};

export const notifyGiftCanceled = async (gift: Gift): Promise<void> => {
  const sender = userRepository.findById(gift.sender_user_id);
  if (!sender) return;
  const text = [
    'ยกเลิกหัตถ์การให้สำเร็จ',
    '',
    `${gift.credit_spent_satang / 100} credit คืนเข้าบัญชีของคุณแล้วค่ะ`,
  ].join('\n');
  await safePush(sender.line_user_id, text, 'gift_canceled');
};

export const notifyGiftRefused = async (gift: Gift): Promise<void> => {
  const sender = userRepository.findById(gift.sender_user_id);
  if (!sender) return;
  const reason =
    gift.refused_reason === 'recipient_already_owns_theme'
      ? 'ผู้รับมีธีมนี้อยู่แล้ว'
      : gift.refused_reason === 'recipient_blocked'
        ? 'บัญชีผู้รับถูกระงับ'
        : 'ไม่สามารถส่งให้ตัวเองได้';
  const text = [
    `หัตถ์การให้ของคุณไม่สามารถใช้ได้: ${reason}`,
    '',
    `${gift.credit_spent_satang / 100} credit คืนเข้าบัญชีของคุณแล้วค่ะ`,
  ].join('\n');
  await safePush(sender.line_user_id, text, 'gift_refused');
};

export const notifyGiftExpired = async (gift: Gift): Promise<void> => {
  const sender = userRepository.findById(gift.sender_user_id);
  if (!sender) return;
  const text = [
    'หัตถ์การให้ของคุณหมดอายุการรับ',
    '',
    `${gift.credit_spent_satang / 100} credit คืนเข้าบัญชีของคุณแล้วค่ะ`,
  ].join('\n');
  await safePush(sender.line_user_id, text, 'gift_expired');
};

export const notifyGiftRevokedToSender = async (gift: Gift): Promise<void> => {
  const sender = userRepository.findById(gift.sender_user_id);
  if (!sender) return;
  const text = [
    'หัตถ์การให้ของคุณถูกยกเลิกโดยทีม Tina',
    `เหตุผล: ${gift.revoke_reason ?? '-'}`,
    '',
    `${gift.credit_spent_satang / 100} credit คืนเข้าบัญชีของคุณแล้วค่ะ`,
  ].join('\n');
  await safePush(sender.line_user_id, text, 'gift_revoked_sender');
};

export const notifyGiftRevokedToRecipient = async (
  gift: Gift
): Promise<void> => {
  if (gift.recipient_user_id === null) return;
  const recipient = userRepository.findById(gift.recipient_user_id);
  if (!recipient) return;
  const text = [
    `${describeGift(gift)} ที่ได้รับเป็นหัตถ์การให้ถูกยกเลิกโดยทีม Tina`,
    `เหตุผล: ${gift.revoke_reason ?? '-'}`,
    '',
    'หากมีข้อสงสัย ติดต่อทีม support ค่ะ',
  ].join('\n');
  await safePush(recipient.line_user_id, text, 'gift_revoked_recipient');
};

/**
 * Resolve the catalog default slug helper for code outside this module that
 * needs the same "if null -> default" convention.
 */
export const resolveActiveThemeSlug = (slug: string | null): string =>
  slug === null ? DEFAULT_THEME_SLUG : slug;
