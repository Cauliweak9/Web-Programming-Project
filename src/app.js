import express from 'express';
import path from 'path';
import cors from 'cors';
import 'dotenv/config'; // 自动加载 .env 变量
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import reviewRoutes from './routes/review.routes.js';
import orderRoutes from './routes/order.routes.js';
import reportRoutes from './routes/report.routes.js';
import skillRoutes from './routes/skill.routes.js';
import { startBlockchainListener } from './services/blockchain.listener.js';
import adminRoutes from './routes/admin.routes.js';

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 捕捉到未处理的 Promise 拒绝:');
    console.error(reason);
});

process.on('uncaughtException', (error) => {
    console.error('🚨 捕捉到未捕获的异常:');
    console.error(error);
});

const app = express();

// 中间件
app.use(cors()); // 允许前端跨域访问
app.use(express.json()); // 解析前端传来的 JSON 数据
app.use(express.static('public')); // 提供静态文件服务

// 挂载路由
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/skills', skillRoutes);
// 启动服务器
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 服务器已成功启动，正在监听端口: http://localhost:${PORT}`);
    startBlockchainListener(); // 启动链上监听器
});
