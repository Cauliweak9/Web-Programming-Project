import express from 'express';
import {
    arbitrateOrder,
    deleteReviewForAdmin,
    getAllOrdersForAdmin,
    getAllReviewsForAdmin,
    hideReviewForAdmin
} from '../controllers/admin.controller.js';
import { verifyAdmin, verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/orders', verifyToken, verifyAdmin, getAllOrdersForAdmin);
router.post('/orders/:orderId/arbitrate', verifyToken, verifyAdmin, arbitrateOrder);

router.get('/reviews', verifyToken, verifyAdmin, getAllReviewsForAdmin);
router.patch('/reviews/:reviewId/hide', verifyToken, verifyAdmin, hideReviewForAdmin);
router.delete('/reviews/:reviewId', verifyToken, verifyAdmin, deleteReviewForAdmin);

export default router;
