import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getAddress } from 'ethers';
import { verifyWalletSignature } from '../services/web3.service.js';

const prisma = new PrismaClient();

function publicUser(user) {
    return {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        creditRating: user.creditRating,
        isBanned: user.isBanned,
        walletAddress: user.walletAddress,
        walletBoundAt: user.walletBoundAt,
        createdAt: user.createdAt
    };
}

export const register = async (req, res) => {
    try {
        const { email, password, nickname } = req.body;

        if (!email || !password || !nickname) {
            return res.status(400).json({ error: '邮箱、密码和昵称不能为空' });
        }

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
        res.status(500).json({ error: '服务器内部错误', details: error.message });
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
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: '登录成功',
            token,
            user: publicUser(user),
            nickname: user.nickname,
            role: user.role
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '服务器内部错误', details: error.message });
    }
};

export const getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                nickname: true,
                role: true,
                creditRating: true,
                isBanned: true,
                walletAddress: true,
                walletBoundAt: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: '获取个人信息失败', details: error.message });
    }
};

export const updateMe = async (req, res) => {
    try {
        const { nickname } = req.body;

        if (!nickname || !nickname.trim()) {
            return res.status(400).json({ error: '昵称不能为空' });
        }

        const user = await prisma.user.update({
            where: { id: req.user.userId },
            data: { nickname: nickname.trim() },
            select: {
                id: true,
                email: true,
                nickname: true,
                role: true,
                creditRating: true,
                isBanned: true,
                walletAddress: true,
                walletBoundAt: true,
                createdAt: true
            }
        });

        res.json({ message: '个人信息已更新', user });
    } catch (error) {
        res.status(500).json({ error: '更新个人信息失败', details: error.message });
    }
};

export const bindWallet = async (req, res) => {
    try {
        const { address, signature } = req.body;
        if (!address || !signature) return res.status(400).json({ error: '钱包地址和签名不能为空' });

        const walletAddress = getAddress(address);
        if (!verifyWalletSignature(req.user.userId, walletAddress, signature)) {
            return res.status(400).json({ error: '签名验证失败，请使用该钱包重新签名' });
        }

        const user = await prisma.user.update({
            where: { id: req.user.userId },
            data: { walletAddress, walletBoundAt: new Date() },
            select: {
                id: true,
                email: true,
                nickname: true,
                role: true,
                creditRating: true,
                isBanned: true,
                walletAddress: true,
                walletBoundAt: true,
                createdAt: true
            }
        });

        res.json({ message: '钱包地址已绑定', user });
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: '该钱包地址已被其他账号绑定' });
        res.status(500).json({ error: '绑定钱包失败', details: error.message });
    }
};
