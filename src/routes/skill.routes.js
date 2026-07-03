import express from 'express';
import { creditEvaluate } from '../controllers/skill.controller.js';

const router = express.Router();

router.post('/credit-evaluate', creditEvaluate);

export default router;
