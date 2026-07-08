import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import reviewRoutes from './routes/review.routes.js';
import orderRoutes from './routes/order.routes.js';
import reportRoutes from './routes/report.routes.js';
import skillRoutes from './routes/skill.routes.js';
import web3Routes from './routes/web3.routes.js';
import { startBlockchainListener } from './services/blockchain.listener.js';
import adminRoutes from './routes/admin.routes.js';

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Promise rejection:');
    console.error(reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:');
    console.error(error);
});

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/docs', express.static('docs'));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/web3', web3Routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server started: http://localhost:${PORT}`);
    startBlockchainListener();
});
