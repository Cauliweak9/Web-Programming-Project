import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const parseOptionalFloat = (value) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
};

const parseRequiredFloat = (value) => {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
};

const productDataFromBody = (body, { partial = false } = {}) => {
    const priceFiat = parseRequiredFloat(body.priceFiat);
    const originalPrice = parseOptionalFloat(body.originalPrice);

    const data = {
        title: body.title,
        description: body.description,
        category: body.category,
        priceFiat: priceFiat === null ? undefined : priceFiat,
        originalPrice,
        imageUrl: body.imageUrl === undefined ? undefined : (body.imageUrl || null),
        condition: body.condition
    };

    if (partial) {
        return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    }

    return data;
};

export const createProduct = async (req, res) => {
    try {
        const { title, description, category, priceFiat, condition } = req.body;
        const parsedPrice = parseRequiredFloat(priceFiat);

        if (!title || !description || !category || !condition || parsedPrice === null) {
            return res.status(400).json({ error: '请填写完整的商品标题、描述、分类、价格和成色' });
        }

        const product = await prisma.product.create({
            data: {
                ...productDataFromBody(req.body),
                sellerId: req.user.userId
            }
        });

        res.status(201).json({ message: '商品发布成功', product });
    } catch (error) {
        res.status(500).json({ error: '发布商品失败', details: error.message });
    }
};

export const getProducts = async (req, res) => {
    try {
        const {
            keyword,
            category,
            minPrice,
            maxPrice,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const pageNum = Math.max(parseInt(page) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 50);
        const skip = (pageNum - 1) * limitNum;
        const safeSortBy = ['createdAt', 'priceFiat', 'originalPrice', 'title'].includes(sortBy) ? sortBy : 'createdAt';
        const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

        const where = { isAvailable: true };

        if (category) {
            where.category = category;
        }

        if (keyword) {
            where.OR = [
                { title: { contains: keyword, mode: 'insensitive' } },
                { description: { contains: keyword, mode: 'insensitive' } },
                { category: { contains: keyword, mode: 'insensitive' } }
            ];
        }

        const min = parseOptionalFloat(minPrice);
        const max = parseOptionalFloat(maxPrice);
        if (min !== undefined || max !== undefined) {
            where.priceFiat = {};
            if (min !== undefined && min !== null) where.priceFiat.gte = min;
            if (max !== undefined && max !== null) where.priceFiat.lte = max;
        }

        const [total, products] = await prisma.$transaction([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    seller: { select: { id: true, nickname: true, email: true } }
                },
                orderBy: { [safeSortBy]: safeSortOrder }
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

export const getMyProducts = async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            where: { sellerId: req.user.userId },
            include: {
                seller: { select: { id: true, nickname: true, email: true } },
                _count: { select: { orders: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            meta: { total: products.length },
            products
        });
    } catch (error) {
        res.status(500).json({ error: '获取我的发布失败', details: error.message });
    }
};

export const updateProduct = async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const currentUserId = req.user.userId;

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) {
            return res.status(404).json({ error: '商品不存在' });
        }

        if (product.sellerId !== currentUserId) {
            return res.status(403).json({ error: '越权操作：你不是该商品的发布者，无权修改' });
        }

        const updatedProduct = await prisma.product.update({
            where: { id: productId },
            data: productDataFromBody(req.body, { partial: true })
        });

        res.json({ message: '商品修改成功', product: updatedProduct });
    } catch (error) {
        res.status(500).json({ error: '更新商品失败', details: error.message });
    }
};

export const delistProduct = async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const currentUserId = req.user.userId;

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) {
            return res.status(404).json({ error: '商品不存在' });
        }

        if (product.sellerId !== currentUserId) {
            return res.status(403).json({ error: '越权操作：无权下架该商品' });
        }

        await prisma.product.update({
            where: { id: productId },
            data: { isAvailable: false }
        });

        res.json({ message: '商品已成功下架' });
    } catch (error) {
        res.status(500).json({ error: '下架商品失败', details: error.message });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const currentUserId = req.user.userId;

        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { _count: { select: { orders: true } } }
        });

        if (!product) {
            return res.status(404).json({ error: '商品不存在' });
        }

        if (product.sellerId !== currentUserId) {
            return res.status(403).json({ error: '越权操作：无权删除该商品' });
        }

        if (product._count.orders > 0) {
            return res.status(400).json({ error: '该商品已有订单记录，只能下架，不能删除' });
        }

        await prisma.product.delete({ where: { id: productId } });

        res.json({ message: '商品已成功删除' });
    } catch (error) {
        res.status(500).json({ error: '删除商品失败', details: error.message });
    }
};

export const getProductById = async (req, res) => {
    try {
        const productId = parseInt(req.params.id);

        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                seller: {
                    select: {
                        id: true,
                        nickname: true,
                        email: true,
                        creditRating: true
                    }
                }
            }
        });

        if (!product) {
            return res.status(404).json({ error: '商品不存在或已被删除' });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ error: '获取商品详情失败', details: error.message });
    }
};
