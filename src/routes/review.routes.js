import express from 'express';
import { createReview, getUserReviews } from '../controllers/review.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// 受保护接口：只有登录后才能给别人打分写评语
router.post('/', verifyToken, createReview);

// 开放接口：任何人（包括第三方调用）都能看某个商家的历史信用评价
router.get('/user/:id', getUserReviews);

export default router;