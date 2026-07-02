import express from 'express';
import { createProductReport } from '../controllers/report.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', verifyToken, createProductReport);

export default router;
