import express from 'express';
import {
    arbitrateOrder,
    banUserForAdmin,
    deleteProductForAdmin,
    deleteReviewForAdmin,
    getAdminStats,
    getAllOrdersForAdmin,
    getAllProductsForAdmin,
    getAllReportsForAdmin,
    getAllReviewsForAdmin,
    getAllUsersForAdmin,
    hideReviewForAdmin,
    resetUserPasswordForAdmin,
    resolveReportForAdmin,
    takedownProductForAdmin,
    unbanUserForAdmin
} from '../controllers/admin.controller.js';
import { verifyAdmin, verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/stats', verifyToken, verifyAdmin, getAdminStats);

router.get('/users', verifyToken, verifyAdmin, getAllUsersForAdmin);
router.patch('/users/:id/ban', verifyToken, verifyAdmin, banUserForAdmin);
router.patch('/users/:id/unban', verifyToken, verifyAdmin, unbanUserForAdmin);
router.patch('/users/:id/reset-password', verifyToken, verifyAdmin, resetUserPasswordForAdmin);

router.get('/products', verifyToken, verifyAdmin, getAllProductsForAdmin);
router.patch('/products/:id/takedown', verifyToken, verifyAdmin, takedownProductForAdmin);
router.delete('/products/:id', verifyToken, verifyAdmin, deleteProductForAdmin);

router.get('/orders', verifyToken, verifyAdmin, getAllOrdersForAdmin);
router.post('/orders/:orderId/arbitrate', verifyToken, verifyAdmin, arbitrateOrder);

router.get('/reviews', verifyToken, verifyAdmin, getAllReviewsForAdmin);
router.patch('/reviews/:reviewId/hide', verifyToken, verifyAdmin, hideReviewForAdmin);
router.delete('/reviews/:reviewId', verifyToken, verifyAdmin, deleteReviewForAdmin);

router.get('/reports', verifyToken, verifyAdmin, getAllReportsForAdmin);
router.patch('/reports/:id/resolve', verifyToken, verifyAdmin, resolveReportForAdmin);

export default router;
