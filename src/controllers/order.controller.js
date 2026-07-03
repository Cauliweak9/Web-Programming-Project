import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
const prisma = new PrismaClient();

export const createOrder = async (req, res) => {
    try {
        const { productId, cryptoAmount } = req.body;

        // 💡 核心检查：确保你的 verifyToken 中间件注入的属性名与这里完全一致（id 或 userId）
        const buyerId = req.user?.userId;

        if (!buyerId) {
            return res.status(401).json({ error: "登录凭证解析失败，无法获取买家ID" });
        }

        if (!productId || !cryptoAmount) {
            return res.status(400).json({ error: "缺少必要参数：productId 或 cryptoAmount" });
        }

        const product = await prisma.product.findUnique({
            where: { id: Number(productId) }
        });

        if (!product) {
            return res.status(404).json({ error: "商品不存在" });
        }

        if (!product.isAvailable) {
            return res.status(400).json({ error: "该商品已被锁定或已售出" });
        }

        if (product.sellerId === Number(buyerId)) {
            return res.status(400).json({ error: "防刷提示：你不能购买自己发布的商品" });
        }

        // 悲观锁数据库事务
        const newOrder = await prisma.$transaction(async (tx) => {
            // 1. 将商品下架
            await tx.product.update({
                where: { id: product.id },
                data: { isAvailable: false }
            });

            // 2. 使用标准的 connect 语法创建 PENDING 订单
            return await tx.order.create({
                data: {
                    status: 'PENDING',
                    cryptoAmount: String(cryptoAmount),
                    // 👇 改用关系型连接，规避标量外键解析迷思
                    product: {
                        connect: { id: product.id }
                    },
                    buyer: {
                        connect: { id: Number(buyerId) }
                    },
                    seller: {
                        connect: { id: product.sellerId }
                    }
                }
            });
        });

        return res.status(201).json({
            message: "订单创建成功，请在链上锁定资金",
            orderId: newOrder.id,
            status: newOrder.status,
            cryptoAmount: newOrder.cryptoAmount
        });

    } catch (error) {
        console.error("创建订单失败:", error);
        return res.status(500).json({ error: "服务器内部错误，订单创建失败" });
    }
};

// 在 order.controller.js 中补充这个方法
export const getUserOrders = async (req, res) => {
    try {
        // 从 JWT 中解析出来的用户 ID
        const userId = req.user.userId; // 如果你的 token 里存的是 id，这里就换成 req.user.id

        // 去数据库捞出所有与该用户相关的订单
        const orders = await prisma.order.findMany({
            where: {
                OR: [
                    { buyerId: userId },
                    { sellerId: userId }
                ]
            },
            // 把商品详情带上，方便前端展示
            include: {
                product: true,
                reviews: {
                    select: {
                        id: true,
                        reviewerId: true,
                        revieweeId: true,
                        orderId: true
                    }
                }
            },
            // 按时间倒序，最新的订单在最前面
            orderBy: {
                createdAt: 'desc'
            }
        });

        // 格式化一下返回给前端
        return res.status(200).json({
            meta: { total: orders.length },
            orders: orders
        });

    } catch (error) {
        console.error("🚨 获取个人订单列表崩溃:", error);
        return res.status(500).json({ error: "获取订单列表失败", details: error.message });
    }
};

// 通用订单状态更新 (发货、收货、发起纠纷)
export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body; // 前端传过来的新状态，如 'SHIPPED', 'COMPLETED', 'DISPUTED'
        const userId = req.user.userId;

        // 先查出这笔订单
        const order = await prisma.order.findUnique({
            where: { id: parseInt(orderId) }
        });

        if (!order) return res.status(404).json({ error: "订单不存在" });

        // 🛡️ 极简的权限校验：
        // 只有卖家能发货
        if (status === 'SHIPPED' && order.sellerId !== userId) {
            return res.status(403).json({ error: "只有卖家才能确认发货" });
        }
        // 只有买家能确认收货或提起仲裁
        if ((status === 'COMPLETED' || status === 'DISPUTED') && order.buyerId !== userId) {
            return res.status(403).json({ error: "只有买家才能进行此操作" });
        }

        // 更新订单状态
        const updatedOrder = await prisma.order.update({
            where: { id: parseInt(orderId) },
            data: { status }
        });

        return res.status(200).json(updatedOrder);
    } catch (error) {
        console.error("🚨 状态更新失败:", error);
        return res.status(500).json({ error: "更新状态失败" });
    }
};

export const mockPayOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        // 1. 安全地读取 config.ini (即使文件不存在也不会让程序崩溃)
        let isWeb3Mode = false; // 默认给 false 方便你现在测试
        try {
            const iniPath = path.resolve(process.cwd(), 'config.ini');
            if (fs.existsSync(iniPath)) {
                const content = fs.readFileSync(iniPath, 'utf8');
                const match = content.match(/WEB3_MODE\s*=\s*(\w+)/);
                if (match) isWeb3Mode = match[1].toUpperCase() === 'TRUE';
            }
        } catch (err) {
            console.warn("⚠️ 读取 config.ini 失败，按默认 Web2 模式执行。");
        }

        if (isWeb3Mode) {
            return res.status(400).json({ error: "当前处于真 Web3 模式，请去链上发起交易而非调用此模拟接口" });
        }

        // 2. 检查订单
        const parsedId = Number(orderId);
        if (isNaN(parsedId)) return res.status(400).json({ error: "订单 ID 格式不正确" });

        const order = await prisma.order.findUnique({ where: { id: parsedId } });
        if (!order) return res.status(404).json({ error: "订单不存在" });
        if (order.status !== 'PENDING') return res.status(400).json({ error: `订单当前状态为 ${order.status}，不可付款` });

        // 3. 更新数据库
        const updatedOrder = await prisma.order.update({
            where: { id: parsedId },
            data: {
                status: 'LOCKED',
                txHash: '0x_mock_tx_hash_' + Math.random().toString(16).substring(2, 10)
            }
        });

        return res.status(200).json({
            message: "[模拟成功] 订单状态已强行变更为 LOCKED",
            orderId: updatedOrder.id,
            status: updatedOrder.status
        });

    } catch (error) {
        // 👇 关键改动：把真正的错误甩在控制台上！
        console.error("🚨 mockPayOrder 彻底崩溃，真实原因：", error);
        return res.status(500).json({ error: "模拟付款失败", details: error.message });
    }
};

export const cancelOrder = async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        const userId = req.user.userId;

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({ error: '订单 ID 格式不正确' });
        }

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { product: true }
        });

        if (!order) {
            return res.status(404).json({ error: '订单不存在' });
        }

        if (order.buyerId !== userId) {
            return res.status(403).json({ error: '只有买家可以取消自己的订单' });
        }

        if (order.status !== 'PENDING') {
            return res.status(400).json({ error: '只有待付款 PENDING 订单可以取消' });
        }

        await prisma.$transaction([
            prisma.order.delete({ where: { id: order.id } }),
            prisma.product.update({
                where: { id: order.productId },
                data: { isAvailable: true }
            })
        ]);

        res.json({ message: '订单已取消，商品已恢复在售', orderId });
    } catch (error) {
        console.error('取消订单失败:', error);
        res.status(500).json({ error: '取消订单失败', details: error.message });
    }
};
