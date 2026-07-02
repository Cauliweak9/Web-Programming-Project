import express from 'express';
import {
    createProduct,
    deleteProduct,
    delistProduct,
    getMyProducts,
    getProductById,
    getProducts,
    updateProduct
} from '../controllers/product.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/my/list', verifyToken, getMyProducts);
router.get('/:id', getProductById);

router.post('/', verifyToken, createProduct);
router.put('/:id', verifyToken, updateProduct);
router.delete('/:id', verifyToken, delistProduct);
router.delete('/:id/permanent', verifyToken, deleteProduct);

export default router;
