import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const verifyToken = (req, res, next) => {
    // 1. 从请求头（Authorization）中获取 Token
    // 前端规范格式通常为: Bearer <token>
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '拒绝访问：未提供身份令牌' });
    }

    try {
        // 2. 校验 Token 是否有效
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. 将解析出来的用户信息（如 userId）挂载到请求对象 req 上
        req.user = decoded;

        // 4. 放行，进入下一个中间件或控制器
        next();
    } catch (error) {
        return res.status(403).json({ error: '令牌无效或已过期' });
    }
};

export const verifyAdmin = async (req, res, next) => {
    // 此时 req.user 里至少有 userId (或者 id，取决于你 login 时怎么签的)
    if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: "未登录或Token无效" });
    }

    try {
        // 直接去数据库查这个人的最新底细
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId }
        });

        if (!user || user.role !== 'ADMIN') {
            return res.status(403).json({ error: "权限不足：只有管理员可以访问此接口" });
        }

        next(); // 确认是管理员，放行！
    } catch (error) {
        console.error("🚨 管理员鉴权查库失败:", error);
        return res.status(500).json({ error: "服务器内部错误" });
    }
};