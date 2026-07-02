import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const register = async (req, res) => {
    try {
        const { email, password, nickname } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: '该邮箱已被注册' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, passwordHash, nickname }
        });

        res.status(201).json({ message: '注册成功', userId: user.id });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({
            error: '服务器内部错误',
            details: error.message,
            stack: error.stack
        });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        if (user.isBanned) {
            return res.status(403).json({ error: '该账号已被管理员封禁，暂时无法登录' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ message: '登录成功', token, nickname: user.nickname });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({
            error: '服务器内部错误',
            details: error.message,
            stack: error.stack
        });
    }
};
