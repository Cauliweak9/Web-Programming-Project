import express from 'express';
import { getMe, login, register, updateMe } from '../controllers/auth.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, getMe);
router.put('/me', verifyToken, updateMe);

export default router;
