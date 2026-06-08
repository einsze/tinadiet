import { Router } from 'express';
import authRouter from './auth.js';
import usersRouter from './users.js';
import foodLogsRouter from './food_logs.js';
import weightLogsRouter from './weight_logs.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/food-logs', foodLogsRouter);
router.use('/weight-logs', weightLogsRouter);

export default router;
