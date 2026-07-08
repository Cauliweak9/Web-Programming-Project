import express from 'express';
import { getPublicWeb3Config, getWalletBindMessage } from '../controllers/web3.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/config', getPublicWeb3Config);
router.get('/bind-message', verifyToken, getWalletBindMessage);

export default router;
