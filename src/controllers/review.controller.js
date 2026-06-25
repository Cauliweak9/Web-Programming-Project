import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. 发表评价 (受保护接口)
// POST /api/reviews
export const createReview = async (req, res) => {
    try {
        const reviewerId = req.user.userId; // 评价发起人（当前登录用户）
        const { revieweeId, rating, content } = req.body;

        const targetRevieweeId = parseInt(revieweeId);
        const ratingNum = parseInt(rating);

        // 🛑 安全校验一：评分范围必须在 1 ~ 5 之间
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: '非法参数：评分必须在 1 到 5 星之间' });
        }

        // 🛑 安全校验二：绝对不允许自己给自己写评价
        if (reviewerId === targetRevieweeId) {
            return res.status(400).json({ error: '防刷提示：你不能给自己发表评价' });
        }

        // 🛑 安全校验三：检查被评价的用户是否存在
        const revieweeUser = await prisma.user.findUnique({ where: { id: targetRevieweeId } });
        if (!revieweeUser) {
            return res.status(404).json({ error: '目标用户不存在，无法评价' });
        }

        // 📈 信用分奖惩机制算法
        let creditChange = 0;
        if (ratingNum === 5) {
            creditChange = 2;  // 5星好评：信用分 +2
        } else if (ratingNum === 4) {
            creditChange = 1;  // 4星中好评：信用分 +1
        } else if (ratingNum <= 2) {
            creditChange = -5; // 1-2星差评：重罚信用分 -5
        } // 3星不加不减

        // 🔄 使用 Prisma $transaction 确保原子性（要么全成功，要么全失败）
        const [newReview, updatedUser] = await prisma.$transaction([
            // 动作 A：创建评价记录
            prisma.review.create({
                data: {
                    rating: ratingNum,
                    content,
                    reviewerId,
                    revieweeId: targetRevieweeId
                },
                include: {
                    reviewer: { select: { nickname: true } } // 顺便把评价人的昵称带出来返回给前端
                }
            }),
            // 动作 B：动态更新被评价人的信用分
            prisma.user.update({
                where: { id: targetRevieweeId },
                data: {
                    creditRating: {
                        increment: creditChange // Prisma 原生支持自增/自减，防止并发覆盖
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

// 2. 获取指定用户的全部评价及信用详情 (开放接口)
// GET /api/reviews/user/:id
export const getUserReviews = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // 1. 先查出该用户的基本资料和当前信用分
        const userProfile = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, nickname: true, email: true, creditRating: true }
        });

        if (!userProfile) {
            return res.status(404).json({ error: '未找到该用户' });
        }

        // 2. 查出别人写给他的历史评价列表
        const reviews = await prisma.review.findMany({
            where: { revieweeId: userId },
            include: {
                reviewer: { select: { nickname: true } } // 显示是谁给写的评价
            },
            orderBy: { createdAt: 'desc' } // 按最新评价排序
        });

        res.json({
            user: userProfile,
            reviewsCount: reviews.length,
            reviews
        });

    } catch (error) {
        console.error('获取用户评价失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
};