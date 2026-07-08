import { PrismaClient } from '@prisma/client';
import { getWeb3Config } from '../config/app.config.js';
import { verifyEscrowEvent } from '../services/web3.service.js';
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
            where: { id: Number(productId) },
            include: { seller: { select: { walletAddress: true } } }
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

        const web3Config = getWeb3Config();
        const buyer = await prisma.user.findUnique({ where: { id: Number(buyerId) }, select: { walletAddress: true } });

        if (web3Config.web3Mode) {
            if (!web3Config.contractAddress) return res.status(400).json({ error: "Web3 模式未配置合约地址" });
            if (!buyer?.walletAddress) return res.status(400).json({ error: "请先在个人信息页绑定买家钱包地址" });
            if (!product.seller?.walletAddress) return res.status(400).json({ error: "卖家尚未绑定钱包地址，暂不能进行链上交易" });
        }

        const newOrder = await prisma.$transaction(async (tx) => {
            await tx.product.update({
                where: { id: product.id },
                data: { isAvailable: false }
            });

            return await tx.order.create({
                data: {
                    status: 'PENDING',
                    cryptoAmount: String(cryptoAmount),
                    chainId: web3Config.web3Mode ? web3Config.chainId : null,
                    contractAddress: web3Config.web3Mode ? web3Config.contractAddress : null,
                    buyerAddress: web3Config.web3Mode ? buyer.walletAddress : null,
                    sellerAddress: web3Config.web3Mode ? product.seller.walletAddress : null,
                    product: { connect: { id: product.id } },
                    buyer: { connect: { id: Number(buyerId) } },
                    seller: { connect: { id: product.sellerId } }
                }
            });
        });

        return res.status(201).json({
            message: "订单创建成功，请在链上锁定资金",
            orderId: newOrder.id,
            status: newOrder.status,
            cryptoAmount: newOrder.cryptoAmount,
            web3: web3Config.web3Mode ? {
                chainId: newOrder.chainId,
                contractAddress: newOrder.contractAddress,
                sellerAddress: newOrder.sellerAddress
            } : null
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
                buyer: { select: { id: true, walletAddress: true } },
                seller: { select: { id: true, walletAddress: true } },
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
        const { status, txHash } = req.body; // 前端传过来的新状态，如 'SHIPPED', 'COMPLETED', 'DISPUTED'
        const userId = req.user.userId;
        const web3Config = getWeb3Config();

        // 先查出这笔订单
        const order = await prisma.order.findUnique({
            where: { id: parseInt(orderId) },
            include: {
                buyer: { select: { walletAddress: true } },
                seller: { select: { walletAddress: true } }
            }
        });

        if (!order) return res.status(404).json({ error: "订单不存在" });
        if (!['SHIPPED', 'COMPLETED', 'DISPUTED'].includes(status)) {
            return res.status(400).json({ error: "订单目标状态不合法" });
        }

        // 🛡️ 极简的权限校验：
        // 只有卖家能发货
        if (status === 'SHIPPED' && order.sellerId !== userId) {
            return res.status(403).json({ error: "只有卖家才能确认发货" });
        }
        // 只有买家能确认收货或提起仲裁
        if ((status === 'COMPLETED' || status === 'DISPUTED') && order.buyerId !== userId) {
            return res.status(403).json({ error: "只有买家才能进行此操作" });
        }

        if (web3Config.web3Mode) {
            if (!txHash) return res.status(400).json({ error: "Web3 模式必须提交链上交易哈希" });
            const action = { SHIPPED: 'SHIP', COMPLETED: 'COMPLETE', DISPUTED: 'DISPUTE' }[status];
            await verifyEscrowEvent({ order, action, txHash });
        }

        const txData = web3Config.web3Mode
            ? ({ SHIPPED: { shipTxHash: txHash }, COMPLETED: { completeTxHash: txHash }, DISPUTED: { disputeTxHash: txHash } }[status])
            : {};

        const updatedOrder = await prisma.order.update({
            where: { id: parseInt(orderId) },
            data: { status, ...txData }
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

        if (getWeb3Config().web3Mode) {
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

export const confirmWeb3Payment = async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        const { txHash } = req.body;
        const userId = req.user.userId;

        if (!txHash) return res.status(400).json({ error: "缺少链上交易哈希" });

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                buyer: { select: { walletAddress: true } },
                seller: { select: { walletAddress: true } }
            }
        });

        if (!order) return res.status(404).json({ error: "订单不存在" });
        if (order.buyerId !== userId) return res.status(403).json({ error: "只有买家可以确认付款" });
        if (order.status !== 'PENDING') return res.status(400).json({ error: `订单当前状态为 ${order.status}，不可确认付款` });

        const { config } = await verifyEscrowEvent({ order, action: 'LOCK', txHash });
        const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'LOCKED',
                txHash,
                lockTxHash: txHash,
                chainId: config.chainId,
                contractAddress: config.contractAddress
            }
        });

        res.json({ message: "链上付款已确认，订单已锁定", orderId: updatedOrder.id, status: updatedOrder.status });
    } catch (error) {
        console.error("确认链上付款失败:", error);
        res.status(400).json({ error: error.message || "确认链上付款失败" });
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
