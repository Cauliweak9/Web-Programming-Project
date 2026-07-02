import express from 'express';
import { createReview, getUserReviews, getUserReviewSummary } from '../controllers/review.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', verifyToken, createReview);
router.get('/summary/:id', getUserReviewSummary);
router.get('/user/:id', getUserReviews);

export default router;
