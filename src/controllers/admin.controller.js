import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. 获取全系统的全局统计和所有订单（用于管理大盘）
export const getAllOrdersForAdmin = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            include: {
                // 🛑 把 username 改回 nickname
                buyer: { select: { nickname: true } },
                seller: { select: { nickname: true } },
                // 🛑 把 price 改回 priceFiat
                product: { select: { title: true, priceFiat: true } }
            },
            orderBy: { id: 'desc' }
        });
        return res.status(200).json(orders);
    } catch (error) {
        // 💡 必须加上这一行！这样控制台就能看到 Prisma 究竟在抱怨什么
        console.error("🚨 Prisma 查询大盘崩溃:", error);
        return res.status(500).json({ error: "获取订单管理列表失败" });
    }
};

// 2. 管理员介入强制仲裁
export const arbitrateOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { decision } = req.body; // "RELEASE" (放款给卖家) 或 "REFUND" (退款给买家)

        if (!['RELEASE', 'REFUND'].includes(decision)) {
            return res.status(400).json({ error: "仲裁决定不合法，必须为 RELEASE 或 REFUND" });
        }

        const order = await prisma.order.findUnique({ where: { id: Number(orderId) } });
        if (!order) return res.status(404).json({ error: "订单不存在" });
        if (order.status !== 'DISPUTED') {
            return res.status(400).json({ error: "只有处于 DISPUTED (纠纷中) 状态的订单才能进行仲裁" });
        }

        // 查看当前是模拟模式还是真Web3模式
        // (逻辑与上面类似，如果是真Web3模式，管理员点击按钮应引导前端去调用智能合约的仲裁函数，这里我们先完成数据库状态变更)
        const targetStatus = decision === 'RELEASE' ? 'RELEASED' : 'REFUNDED';

        const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: { status: targetStatus }
        });

        return res.status(200).json({
            message: `⚖️ 管理员仲裁成功，订单已强行变更状态为: ${targetStatus}`,
            orderId: updatedOrder.id,
            status: updatedOrder.status
        });

    } catch (error) {
        return res.status(500).json({ error: "仲裁执行失败" });
    }
};