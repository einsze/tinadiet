import { Router } from 'express';
import authRouter from './auth.js';
import usersRouter from './users.js';
import foodLogsRouter from './food_logs.js';
import weightLogsRouter from './weight_logs.js';
import chatRouter from './chat.js';
import billingRouter from './billing.js';
import accountRouter from './account.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/food-logs', foodLogsRouter);
router.use('/weight-logs', weightLogsRouter);
router.use('/chat', chatRouter);
router.use('/billing', billingRouter);
router.use('/account', accountRouter);

export default router;
