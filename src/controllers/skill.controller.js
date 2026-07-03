import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const getCreditLevel = (creditRating) => {
    if (creditRating >= 100) return '优秀';
    if (creditRating >= 90) return '良好';
    if (creditRating >= 75) return '一般';
    return '较低';
};

const getRiskLevel = (creditRating, negativeReviewCount) => {
    if (negativeReviewCount >= 3 || creditRating < 75) return '高风险';
    if (negativeReviewCount >= 1 || creditRating < 90) return '中风险';
    return '低风险';
};

const getAdvice = (riskLevel) => {
    if (riskLevel === '高风险') {
        return '该用户存在较高交易风险，建议交易前充分沟通，优先选择当面验货或平台担保流程。';
    }
    if (riskLevel === '中风险') {
        return '该用户信誉表现一般，建议关注近期评价内容，并在交易中保留沟通和支付凭证。';
    }
    return '该用户信誉较好，建议继续保持及时沟通和按时发货。';
};

export const creditEvaluate = async (req, res) => {
    try {
        const userId = Number(req.body?.userId);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({
                error: 'userId 缺失或格式不正确',
                example: { userId: 2 }
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                nickname: true,
                email: true,
                creditRating: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: '用户不存在', userId });
        }

        const reviews = await prisma.review.findMany({
            where: {
                revieweeId: userId,
                isHidden: false
            },
            select: {
                rating: true
            }
        });

        const reviewCount = reviews.length;
        const ratingTotal = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = reviewCount > 0 ? Number((ratingTotal / reviewCount).toFixed(1)) : 0;
        const negativeReviewCount = reviews.filter((review) => review.rating <= 2).length;
        const creditLevel = getCreditLevel(user.creditRating);
        const riskLevel = getRiskLevel(user.creditRating, negativeReviewCount);

        return res.json({
            userId: user.id,
            nickname: user.nickname,
            email: user.email,
            creditRating: user.creditRating,
            averageRating,
            reviewCount,
            negativeReviewCount,
            creditLevel,
            riskLevel,
            advice: getAdvice(riskLevel)
        });
    } catch (error) {
        console.error('信誉评估 Skill 执行失败:', error);
        return res.status(500).json({
            error: '信誉评估失败',
            details: error.message
        });
    }
};
