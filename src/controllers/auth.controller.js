import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const register = async (req, res) => {
    try {
        const { email, password, nickname } = req.body;

        // 1. 检查用户是否已存在
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: '该邮箱已被注册' });
        }

        // 2. 加密密码 (盐值设为 10)
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 3. 存入数据库
        const user = await prisma.user.create({
            data: { email, passwordHash, nickname }
        });

        res.status(201).json({ message: '注册成功', userId: user.id });
    } catch (error) {
        // 1. 让控制台打印错误 
        console.error('注册失败，详细错误信息:', error);

        // 2. 临时把错误信息传给 PowerShell，方便排查
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

        // 1. 查找用户
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        // 2. 校验密码
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        // 3. 签发 JWT 令牌 (有效期 24 小时)
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ message: '登录成功', token, nickname: user.nickname });
    } catch (error) {
        // 1. 让控制台打印错误 
        console.error('注册失败，详细错误信息:', error);

        // 2. 临时把错误信息传给 PowerShell，方便排查
        res.status(500).json({
            error: '服务器内部错误',
            details: error.message,
            stack: error.stack
        });
    }
};