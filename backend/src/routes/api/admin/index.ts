import { Router } from 'express';
import authRouter from './auth.js';
import paymentsRouter from './payments.js';
import usersRouter from './users.js';
import settingsRouter from './settings.js';
import operatorsRouter from './operators.js';
import giftsRouter from './gifts.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/payments', paymentsRouter);
router.use('/users', usersRouter);
router.use('/settings', settingsRouter);
router.use('/operators', operatorsRouter);
router.use('/gifts', giftsRouter);

export default router;
