import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const getAdminStats = async (req, res) => {
    try {
        const [usersCount, productsCount, ordersCount, completedOrders, reportsCount, pendingReportsCount] = await Promise.all([
            prisma.user.count(),
            prisma.product.count(),
            prisma.order.count(),
            prisma.order.findMany({
                where: { status: 'COMPLETED' },
                include: { product: { select: { priceFiat: true } } }
            }),
            prisma.report.count(),
            prisma.report.count({ where: { status: 'PENDING' } })
        ]);

        const completedTradeAmount = completedOrders.reduce((sum, order) => sum + (order.product?.priceFiat || 0), 0);

        res.json({
            usersCount,
            productsCount,
            ordersCount,
            completedTradeAmount,
            reportsCount,
            pendingReportsCount
        });
    } catch (error) {
        console.error('获取后台统计失败:', error);
        res.status(500).json({ error: '获取后台统计失败' });
    }
};

export const getAllUsersForAdmin = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                nickname: true,
                role: true,
                creditRating: true,
                isBanned: true,
                createdAt: true
            },
            orderBy: { id: 'asc' }
        });
        res.json(users);
    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({ error: '获取用户列表失败' });
    }
};

export const banUserForAdmin = async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (userId === req.user.userId) {
            return res.status(400).json({ error: '不能封禁当前登录的管理员账号' });
        }

        const target = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (!target) {
            return res.status(404).json({ error: '用户不存在' });
        }

        if (target.role === 'ADMIN') {
            return res.status(400).json({ error: '不能封禁管理员账号' });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { isBanned: true },
            select: { id: true, email: true, nickname: true, isBanned: true }
        });
        res.json({ message: '用户已封禁', user });
    } catch (error) {
        console.error('封禁用户失败:', error);
        res.status(500).json({ error: '封禁用户失败' });
    }
};

export const unbanUserForAdmin = async (req, res) => {
    try {
        const user = await prisma.user.update({
            where: { id: Number(req.params.id) },
            data: { isBanned: false },
            select: { id: true, email: true, nickname: true, isBanned: true }
        });
        res.json({ message: '用户已解封', user });
    } catch (error) {
        console.error('解封用户失败:', error);
        res.status(500).json({ error: '解封用户失败' });
    }
};

export const resetUserPasswordForAdmin = async (req, res) => {
    try {
        const passwordHash = await bcrypt.hash('123456', 10);
        const user = await prisma.user.update({
            where: { id: Number(req.params.id) },
            data: { passwordHash },
            select: { id: true, email: true, nickname: true }
        });
        res.json({ message: '密码已重置为 123456', user });
    } catch (error) {
        console.error('重置密码失败:', error);
        res.status(500).json({ error: '重置密码失败' });
    }
};

export const getAllProductsForAdmin = async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            include: {
                seller: { select: { id: true, nickname: true, email: true } },
                _count: { select: { orders: true, reports: true } }
            },
            orderBy: { id: 'desc' }
        });
        res.json(products);
    } catch (error) {
        console.error('获取商品列表失败:', error);
        res.status(500).json({ error: '获取商品列表失败' });
    }
};

export const takedownProductForAdmin = async (req, res) => {
    try {
        const product = await prisma.product.update({
            where: { id: Number(req.params.id) },
            data: { isAvailable: false }
        });
        res.json({ message: '商品已下架', product });
    } catch (error) {
        console.error('下架商品失败:', error);
        res.status(500).json({ error: '下架商品失败' });
    }
};

export const deleteProductForAdmin = async (req, res) => {
    try {
        const productId = Number(req.params.id);
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { _count: { select: { orders: true } } }
        });

        if (!product) {
            return res.status(404).json({ error: '商品不存在' });
        }

        if (product._count.orders > 0) {
            return res.status(400).json({ error: '该商品已有订单记录，为保护交易历史，只能下架，不能删除' });
        }

        await prisma.product.delete({ where: { id: productId } });
        res.json({ message: '商品已删除' });
    } catch (error) {
        console.error('删除商品失败:', error);
        res.status(500).json({ error: '删除商品失败' });
    }
};

export const getAllOrdersForAdmin = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            include: {
                buyer: { select: { id: true, nickname: true, email: true } },
                seller: { select: { id: true, nickname: true, email: true } },
                product: { select: { id: true, title: true, priceFiat: true } },
                reviews: true
            },
            orderBy: { id: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        console.error('获取订单管理列表失败:', error);
        res.status(500).json({ error: '获取订单管理列表失败' });
    }
};

export const arbitrateOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const decision = req.body.decision || req.body.action;

        if (!['RELEASE', 'REFUND'].includes(decision)) {
            return res.status(400).json({ error: '仲裁决定不合法，必须为 RELEASE 或 REFUND' });
        }

        const order = await prisma.order.findUnique({ where: { id: Number(orderId) } });
        if (!order) {
            return res.status(404).json({ error: '订单不存在' });
        }

        if (order.status !== 'DISPUTED') {
            return res.status(400).json({ error: '只有 DISPUTED 状态的订单才能仲裁' });
        }

        const targetStatus = decision === 'RELEASE' ? 'RELEASED' : 'REFUNDED';
        const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: { status: targetStatus }
        });

        res.json({
            message: `管理员仲裁成功，订单状态已变更为 ${targetStatus}`,
            orderId: updatedOrder.id,
            status: updatedOrder.status
        });
    } catch (error) {
        console.error('仲裁执行失败:', error);
        res.status(500).json({ error: '仲裁执行失败' });
    }
};

export const getAllReviewsForAdmin = async (req, res) => {
    try {
        const reviews = await prisma.review.findMany({
            include: {
                reviewer: { select: { id: true, nickname: true, email: true } },
                reviewee: { select: { id: true, nickname: true, email: true, creditRating: true } },
                order: { include: { product: { select: { id: true, title: true, priceFiat: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(reviews);
    } catch (error) {
        console.error('获取评价管理列表失败:', error);
        res.status(500).json({ error: '获取评价管理列表失败' });
    }
};

export const hideReviewForAdmin = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { isHidden = true } = req.body;
        const review = await prisma.review.update({
            where: { id: Number(reviewId) },
            data: { isHidden: Boolean(isHidden) }
        });
        res.json({ message: review.isHidden ? '评价已隐藏' : '评价已恢复显示', review });
    } catch (error) {
        console.error('隐藏评价失败:', error);
        res.status(500).json({ error: '隐藏评价失败' });
    }
};

export const deleteReviewForAdmin = async (req, res) => {
    try {
        await prisma.review.delete({ where: { id: Number(req.params.reviewId) } });
        res.json({ message: '评价已删除' });
    } catch (error) {
        console.error('删除评价失败:', error);
        res.status(500).json({ error: '删除评价失败' });
    }
};

export const getAllReportsForAdmin = async (req, res) => {
    try {
        const reports = await prisma.report.findMany({
            include: {
                reporter: { select: { id: true, nickname: true, email: true } },
                product: {
                    include: {
                        seller: { select: { id: true, nickname: true, email: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(reports);
    } catch (error) {
        console.error('获取举报列表失败:', error);
        res.status(500).json({ error: '获取举报列表失败' });
    }
};

export const resolveReportForAdmin = async (req, res) => {
    try {
        const report = await prisma.report.update({
            where: { id: Number(req.params.id) },
            data: { status: 'RESOLVED', handledAt: new Date() }
        });
        res.json({ message: '举报已标记为已处理', report });
    } catch (error) {
        console.error('处理举报失败:', error);
        res.status(500).json({ error: '处理举报失败' });
    }
};
