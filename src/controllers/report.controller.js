import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createProductReport = async (req, res) => {
    try {
        const reporterId = req.user.userId;
        const { productId, reason } = req.body;
        const parsedProductId = Number(productId);

        if (!parsedProductId || !reason || !reason.trim()) {
            return res.status(400).json({ error: '商品 ID 和举报原因不能为空' });
        }

        const product = await prisma.product.findUnique({
            where: { id: parsedProductId }
        });

        if (!product) {
            return res.status(404).json({ error: '商品不存在，无法举报' });
        }

        if (product.sellerId === reporterId) {
            return res.status(400).json({ error: '不能举报自己发布的商品' });
        }

        const report = await prisma.report.create({
            data: {
                productId: parsedProductId,
                reporterId,
                reason: reason.trim()
            },
            include: {
                product: { select: { id: true, title: true } },
                reporter: { select: { id: true, nickname: true, email: true } }
            }
        });

        res.status(201).json({ message: '举报已提交，管理员会尽快处理', report });
    } catch (error) {
        console.error('提交举报失败:', error);
        res.status(500).json({ error: '提交举报失败', details: error.message });
    }
};
