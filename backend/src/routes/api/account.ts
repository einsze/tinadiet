import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { foodLogsRepository } from '../../repositories/food_logs.js';
import { weightLogsRepository } from '../../repositories/weight_logs.js';
import { chatMessagesRepository } from '../../repositories/chat_messages.js';
import { subscriptionsRepository } from '../../repositories/subscriptions.js';
import {
  cancelSubscriptionImmediately,
  deleteStripeCustomer,
  StripeServiceError,
} from '../../services/stripe.js';
import { env } from '../../config/env.js';

const router = Router();

const deleteSchema = z.object({
  confirm: z.literal('DELETE'),
});

router.post('/export', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }
  const user = userRepository.findById(session.uid);
  if (!user) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const today = '9999-12-31';
  const foodLogDates = foodLogsRepository.distinctLogDatesRecent(
    user.id,
    today,
    10000
  );
  const allFoodLogs = foodLogDates.flatMap((date) =>
    foodLogsRepository.listByUserAndDate(user.id, date)
  );
  const allWeightLogs = weightLogsRepository.listRecent(user.id, 100000);
  const recentChatMessages = chatMessagesRepository.listRecent(user.id, 100000);
  const subscription = subscriptionsRepository.findLatestByUser(user.id);

  const payload = {
    export_format_version: 1,
    exported_at: new Date().toISOString(),
    note: 'This file contains all personal data Tina Diet holds about you. Provided in fulfillment of your PDPA right of access and data portability.',
    user: {
      id: user.id,
      line_user_id: user.line_user_id,
      display_name: user.display_name,
      gender: user.gender,
      date_of_birth: user.date_of_birth,
      height_cm: user.height_cm,
      current_weight_kg: user.current_weight_kg,
      target_weight_kg: user.target_weight_kg,
      activity_level: user.activity_level,
      goal_type: user.goal_type,
      bmr_kcal: user.bmr_kcal,
      tdee_kcal: user.tdee_kcal,
      daily_calorie_goal: user.daily_calorie_goal,
      daily_protein_g: user.daily_protein_g,
      daily_carbs_g: user.daily_carbs_g,
      daily_fat_g: user.daily_fat_g,
      locale: user.locale,
      timezone: user.timezone,
      plan: user.plan,
      premium_expires_at: user.premium_expires_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    food_logs: allFoodLogs,
    weight_logs: allWeightLogs,
    chat_messages: recentChatMessages,
    subscription:
      subscription !== undefined
        ? {
            provider: subscription.provider,
            status: subscription.status,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at,
            created_at: subscription.created_at,
            updated_at: subscription.updated_at,
          }
        : null,
  };

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'account.export.success',
      db_user_id: user.id,
      food_log_count: allFoodLogs.length,
      weight_log_count: allWeightLogs.length,
      chat_message_count: recentChatMessages.length,
    })
  );

  const filename = `tinadiet-export-user${user.id}-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(JSON.stringify(payload, null, 2));
});

router.post('/delete', requireAuth, async (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }
  const user = userRepository.findById(session.uid);
  if (!user) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const parsed = deleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'CONFIRMATION_REQUIRED',
        message:
          'Body must contain { "confirm": "DELETE" } to proceed with account deletion',
      },
    });
    return;
  }

  let stripeCancelStatus: 'skipped' | 'canceled' | 'failed' = 'skipped';
  let stripeCustomerDeleteStatus: 'skipped' | 'deleted' | 'failed' = 'skipped';
  let stripeError: string | null = null;

  if (env.STRIPE_SECRET_KEY.length > 0) {
    try {
      const canceled = await cancelSubscriptionImmediately(user);
      stripeCancelStatus = canceled !== null ? 'canceled' : 'skipped';
    } catch (err) {
      const isStripeErr = err instanceof StripeServiceError;
      stripeCancelStatus = 'failed';
      stripeError = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'account.delete.stripe_cancel_failed',
          db_user_id: user.id,
          is_stripe_error: isStripeErr,
          error: stripeError,
        })
      );
    }

    if (user.stripe_customer_id !== null) {
      try {
        await deleteStripeCustomer(user.stripe_customer_id);
        stripeCustomerDeleteStatus = 'deleted';
      } catch (err) {
        stripeCustomerDeleteStatus = 'failed';
        stripeError = err instanceof Error ? err.message : String(err);
        console.error(
          JSON.stringify({
            level: 'error',
            msg: 'account.delete.stripe_customer_delete_failed',
            db_user_id: user.id,
            stripe_customer_id: user.stripe_customer_id,
            error: stripeError,
          })
        );
      }
    }
  }

  const deleted = userRepository.deleteById(user.id);
  if (!deleted) {
    res.status(500).json({
      error: {
        code: 'DELETE_FAILED',
        message:
          'Failed to delete user record. Please contact support if Stripe was already canceled.',
      },
      stripe: {
        subscription_canceled: stripeCancelStatus,
        customer_deleted: stripeCustomerDeleteStatus,
        error: stripeError,
      },
    });
    return;
  }

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'account.delete.success',
      db_user_id: user.id,
      line_user_id: user.line_user_id,
      stripe_subscription_canceled: stripeCancelStatus,
      stripe_customer_deleted: stripeCustomerDeleteStatus,
      had_stripe_customer: user.stripe_customer_id !== null,
    })
  );

  res.status(200).json({
    deleted: true,
    stripe: {
      subscription_canceled: stripeCancelStatus,
      customer_deleted: stripeCustomerDeleteStatus,
    },
    message:
      'Your account and all associated data have been permanently deleted. Goodbye 🌱',
  });
});

export default router;
