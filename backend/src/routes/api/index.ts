import { Router } from 'express';
import authRouter from './auth.js';
import usersRouter from './users.js';
import foodLogsRouter from './food_logs.js';
import weightLogsRouter from './weight_logs.js';
import chatRouter from './chat.js';
import billingRouter from './billing.js';
import accountRouter from './account.js';
import walletRouter from './wallet.js';
import topupRouter from './topup.js';
import premiumRouter from './premium.js';
import themesRouter from './themes.js';
import giftsRouter from './gifts.js';
import historyRouter from './history.js';
import adminRouter from './admin/index.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/food-logs', foodLogsRouter);
router.use('/weight-logs', weightLogsRouter);
router.use('/chat', chatRouter);
router.use('/billing', billingRouter);
router.use('/account', accountRouter);
router.use('/wallet', walletRouter);
router.use('/topup', topupRouter);
router.use('/premium', premiumRouter);
router.use('/themes', themesRouter);
router.use('/gifts', giftsRouter);
router.use('/history', historyRouter);
router.use('/admin', adminRouter);

export default router;
