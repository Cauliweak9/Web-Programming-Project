import express from 'express';
import { cancelOrder, confirmWeb3Payment, createOrder, getUserOrders, mockPayOrder, updateOrderStatus } from '../controllers/order.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', verifyToken, getUserOrders);
router.post('/', verifyToken, createOrder);
router.patch('/:orderId/web3-lock', verifyToken, confirmWeb3Payment);
router.patch('/:orderId/mock-pay', verifyToken, mockPayOrder);
router.patch('/:orderId/status', verifyToken, updateOrderStatus);
router.patch('/:orderId/cancel', verifyToken, cancelOrder);

export default router;
