import express from 'express';
import { createProduct, getProducts, updateProduct, delistProduct, getProductById } from '../controllers/product.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// 开放接口
router.get('/', getProducts);
router.get('/:id', getProductById);

// 受保护接口（必须带 Token）
router.post('/', verifyToken, createProduct);
router.put('/:id', verifyToken, updateProduct);    // 修改商品
router.delete('/:id', verifyToken, delistProduct); // 下架商品

export default router;