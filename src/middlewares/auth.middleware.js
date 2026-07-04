import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '未提供登录令牌' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        return res.status(403).json({ error: '登录令牌无效或已过期' });
    }
};

export const verifyAdmin = async (req, res, next) => {
    if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: '未登录或登录令牌无效' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, role: true, isBanned: true }
        });

        if (!user || user.role !== 'ADMIN') {
            return res.status(403).json({ error: '权限不足：仅管理员可以访问该接口' });
        }

        if (user.isBanned) {
            return res.status(403).json({ error: '该管理员账号已被封禁' });
        }

        next();
    } catch (error) {
        console.error('管理员权限校验失败:', error);
        return res.status(500).json({ error: '服务器内部错误' });
    }
};
