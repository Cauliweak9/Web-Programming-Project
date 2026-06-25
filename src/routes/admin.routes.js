import express from 'express';
import { getAllOrdersForAdmin, arbitrateOrder } from '../controllers/admin.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// 所有的管理员接口都必须过两道关卡：1. 登录了 2. 角色是 ADMIN
router.get('/orders', verifyToken, verifyAdmin, getAllOrdersForAdmin);
router.post('/orders/:orderId/arbitrate', verifyToken, verifyAdmin, arbitrateOrder);

export default router;