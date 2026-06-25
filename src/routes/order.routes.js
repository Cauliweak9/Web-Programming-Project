import express from 'express';
import { createOrder, getUserOrders, mockPayOrder, updateOrderStatus } from '../controllers/order.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// 所有订单操作都必须登录
router.get('/', verifyToken, getUserOrders);
router.post('/', verifyToken, createOrder);
router.patch('/:orderId/mock-pay', verifyToken, mockPayOrder);
router.patch('/:orderId/status', verifyToken, updateOrderStatus);

export default router;