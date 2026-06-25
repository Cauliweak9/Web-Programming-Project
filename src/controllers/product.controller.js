import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. 发布商品 (保持不变)
export const createProduct = async (req, res) => {
    try {
        const { title, description, category, priceFiat, condition } = req.body;
        const sellerId = req.user.userId;

        const product = await prisma.product.create({
            data: {
                title,
                description,
                category,
                priceFiat: parseFloat(priceFiat),
                condition,
                sellerId
            }
        });
        res.status(201).json({ message: '商品发布成功', product });
    } catch (error) {
        res.status(500).json({ error: '发布商品失败', details: error.message });
    }
};

// 2. 获取商品列表 (高级版：支持多条件筛选、分页、价格区间、排序)
// GET /api/products?keyword=xxx&category=xxx&minPrice=10&maxPrice=100&page=1&limit=10&sortBy=priceFiat&sortOrder=desc
export const getProducts = async (req, res) => {
    try {
        const { keyword, category, minPrice, maxPrice, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // 动态构建查询条件 (只展示未下架的商品)
        const where = { isAvailable: true };

        if (category) {
            where.category = category;
        }

        if (keyword) {
            where.OR = [
                { title: { contains: keyword, mode: 'insensitive' } },
                { description: { contains: keyword, mode: 'insensitive' } }
            ];
        }

        // 价格区间筛选
        if (minPrice || maxPrice) {
            where.priceFiat = {};
            if (minPrice) where.priceFiat.gte = parseFloat(minPrice);
            if (maxPrice) where.priceFiat.lte = parseFloat(maxPrice);
        }

        // 利用 Prisma 的 $transaction 并发查询总数和分页数据，极大提升性能
        const [total, products] = await prisma.$transaction([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    seller: { select: { nickname: true, email: true } }
                },
                orderBy: {
                    [sortBy]: sortOrder // 动态排序，例如按照价格(priceFiat)或时间(createdAt)
                }
            })
        ]);

        res.json({
            meta: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            },
            products
        });
    } catch (error) {
        res.status(500).json({ error: '获取商品列表失败', details: error.message });
    }
};

// 3. 编辑商品 (受保护：带越权校验)
// PUT /api/products/:id
export const updateProduct = async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const currentUserId = req.user.userId; // 从 JWT 提取的当前操作者 ID
        const { title, description, category, priceFiat, condition } = req.body;

        // A. 先查出该商品，确认是否存在
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) {
            return res.status(404).json({ error: '商品不存在' });
        }

        // B. 安全红线：检查当前登录用户是不是该商品的卖家
        if (product.sellerId !== currentUserId) {
            return res.status(403).json({ error: '越权操作：你不是该商品的发布者，无权修改' });
        }

        // C. 执行更新
        const updatedProduct = await prisma.product.update({
            where: { id: productId },
            data: {
                title,
                description,
                category,
                priceFiat: priceFiat ? parseFloat(priceFiat) : undefined,
                condition
            }
        });

        res.json({ message: '商品修改成功', product: updatedProduct });
    } catch (error) {
        res.status(500).json({ error: '更新商品失败', details: error.message });
    }
};

// 4. 下架商品 (受保护：软删除，不直接物理删除数据，避免破坏历史订单关联)
// DELETE /api/products/:id
export const delistProduct = async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const currentUserId = req.user.userId;

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) {
            return res.status(404).json({ error: '商品不存在' });
        }

        // 安全检查
        if (product.sellerId !== currentUserId) {
            return res.status(403).json({ error: '越权操作：无权下架该商品' });
        }

        // 软删除：将 isAvailable 置为 false
        await prisma.product.update({
            where: { id: productId },
            data: { isAvailable: false }
        });

        res.json({ message: '商品已成功下架' });
    } catch (error) {
        res.status(500).json({ error: '下架商品失败', details: error.message });
    }
};

// 5. 获取商品详情 (开放接口)
// GET /api/products/:id
export const getProductById = async (req, res) => {
    try {
        const productId = parseInt(req.params.id);

        // 查找唯一的商品，并把卖家的基本信息一并带出来
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                seller: {
                    select: {
                        id: true,
                        nickname: true,
                        email: true
                        // 稍后我们在这里加上信用积分字段
                    }
                }
            }
        });

        // 如果找不到商品，返回 404
        if (!product) {
            return res.status(404).json({ error: '商品不存在或已被彻底删除' });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ error: '获取商品详情失败', details: error.message });
    }
};