import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const getCreditChange = (rating) => {
    if (rating === 5) return 2;
    if (rating === 4) return 1;
    if (rating <= 2) return -5;
    return 0;
};

const buildReviewSummary = (reviews) => {
    const visibleReviews = reviews.filter((review) => !review.isHidden);
    const averageRating = visibleReviews.length
        ? Number((visibleReviews.reduce((sum, review) => sum + review.rating, 0) / visibleReviews.length).toFixed(1))
        : 0;

    return {
        averageRating,
        reviewsCount: visibleReviews.length
    };
};

export const createReview = async (req, res) => {
    try {
        const reviewerId = req.user.userId;
        const { orderId, revieweeId, rating, content } = req.body;
        const targetOrderId = Number(orderId);
        const ratingNum = Number(rating);

        if (!targetOrderId) {
            return res.status(400).json({ error: '缺少订单 ID，必须基于已完成订单评价' });
        }

        if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: '评分必须是 1 到 5 星之间的整数' });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({ error: '评价内容不能为空' });
        }

        const order = await prisma.order.findUnique({
            where: { id: targetOrderId },
            include: {
                product: true,
                seller: { select: { id: true, nickname: true, email: true } }
            }
        });

        if (!order) {
            return res.status(404).json({ error: '订单不存在' });
        }

        if (order.status !== 'COMPLETED') {
            return res.status(400).json({ error: '只有已完成的订单才能评价' });
        }

        if (order.buyerId !== reviewerId) {
            return res.status(403).json({ error: '只有该订单的买家才能评价卖家' });
        }

        if (revieweeId && Number(revieweeId) !== order.sellerId) {
            return res.status(400).json({ error: '只能评价该订单中的卖家' });
        }

        const existingReview = await prisma.review.findUnique({
            where: { orderId: targetOrderId }
        });

        if (existingReview) {
            return res.status(400).json({ error: '该订单已经评价过，不能重复评价' });
        }

        const creditChange = getCreditChange(ratingNum);

        const [newReview, updatedUser] = await prisma.$transaction([
            prisma.review.create({
                data: {
                    rating: ratingNum,
                    content: content.trim(),
                    reviewerId,
                    revieweeId: order.sellerId,
                    orderId: order.id
                },
                include: {
                    reviewer: { select: { id: true, nickname: true } },
                    reviewee: { select: { id: true, nickname: true, creditRating: true } },
                    order: { include: { product: true } }
                }
            }),
            prisma.user.update({
                where: { id: order.sellerId },
                data: {
                    creditRating: {
                        increment: creditChange
                    }
                }
            })
        ]);

        res.status(201).json({
            message: '评价发表成功，对方信用分已更新',
            review: newReview,
            revieweeCurrentCredit: updatedUser.creditRating
        });
    } catch (error) {
        console.error('发表评价失败:', error);
        res.status(500).json({ error: '服务器内部错误', details: error.message });
    }
};

export const getUserReviews = async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const userProfile = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, nickname: true, email: true, creditRating: true }
        });

        if (!userProfile) {
            return res.status(404).json({ error: '未找到该用户' });
        }

        const reviews = await prisma.review.findMany({
            where: { revieweeId: userId, isHidden: false },
            include: {
                reviewer: { select: { id: true, nickname: true } },
                order: { include: { product: { select: { id: true, title: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            user: userProfile,
            ...buildReviewSummary(reviews),
            reviews
        });
    } catch (error) {
        console.error('获取用户评价失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
};

export const getUserReviewSummary = async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const userProfile = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, nickname: true, email: true, creditRating: true }
        });

        if (!userProfile) {
            return res.status(404).json({ error: '未找到该用户' });
        }

        const reviews = await prisma.review.findMany({
            where: { revieweeId: userId, isHidden: false },
            select: { rating: true, isHidden: true }
        });

        res.json({
            user: userProfile,
            ...buildReviewSummary(reviews)
        });
    } catch (error) {
        console.error('获取信誉汇总失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
};
