import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

const command = process.argv[2] || 'help';
const args = process.argv.slice(3);

const formatDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleString('zh-CN', { hour12: false });
};

const toMoney = (value) => {
    const number = Number(value || 0);
    return number.toFixed(2);
};

const printHelp = () => {
    console.log(`
校园二手交易平台 CLI 工具

用法:
  node cli/trade-cli.js help
  node cli/trade-cli.js products
  node cli/trade-cli.js orders
  node cli/trade-cli.js export-orders
  node cli/trade-cli.js ban-user <userId>
  node cli/trade-cli.js unban-user <userId>
  node cli/trade-cli.js stats

也可以通过 npm 脚本运行:
  npm run cli -- products
  npm run cli -- orders
  npm run cli -- export-orders
  npm run cli -- ban-user 3
  npm run cli -- unban-user 3
  npm run cli -- stats

说明:
  products       查看前 20 条商品，按 id 升序
  orders         查看前 20 条订单，按创建时间倒序
  export-orders  导出订单 CSV 到 exports/orders-report.csv
  ban-user       封禁普通用户，不能封禁管理员
  unban-user     解封用户
  stats          查看系统统计数据
`);
};

const listProducts = async () => {
    const products = await prisma.product.findMany({
        take: 20,
        orderBy: { id: 'asc' },
        include: {
            seller: {
                select: {
                    email: true,
                    nickname: true
                }
            }
        }
    });

    if (products.length === 0) {
        console.log('暂无商品数据。');
        return;
    }

    console.table(products.map((product) => ({
        id: product.id,
        标题: product.title,
        分类: product.category,
        价格: toMoney(product.priceFiat),
        在售: product.isAvailable ? '是' : '否',
        卖家: product.seller?.nickname || product.seller?.email || '-'
    })));
};

const listOrders = async () => {
    const orders = await prisma.order.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
            product: { select: { title: true, priceFiat: true } },
            buyer: { select: { email: true, nickname: true } },
            seller: { select: { email: true, nickname: true } }
        }
    });

    if (orders.length === 0) {
        console.log('暂无订单数据。');
        return;
    }

    console.table(orders.map((order) => ({
        id: order.id,
        商品: order.product?.title || '-',
        买家: order.buyer?.nickname || order.buyer?.email || '-',
        卖家: order.seller?.nickname || order.seller?.email || '-',
        状态: order.status,
        金额: toMoney(order.product?.priceFiat),
        创建时间: formatDate(order.createdAt)
    })));
};

const escapeCsv = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replaceAll('"', '""')}"`;
};

const exportOrders = async () => {
    const orders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            product: { select: { title: true, priceFiat: true } },
            buyer: { select: { email: true } },
            seller: { select: { email: true } }
        }
    });

    const exportDir = path.resolve(process.cwd(), 'exports');
    const exportPath = path.join(exportDir, 'orders-report.csv');

    await fs.mkdir(exportDir, { recursive: true });

    const headers = ['orderId', 'productTitle', 'buyerEmail', 'sellerEmail', 'status', 'amount', 'createdAt'];
    const rows = orders.map((order) => [
        order.id,
        order.product?.title || '',
        order.buyer?.email || '',
        order.seller?.email || '',
        order.status,
        toMoney(order.product?.priceFiat),
        formatDate(order.createdAt)
    ]);

    const csv = [
        headers.join(','),
        ...rows.map((row) => row.map(escapeCsv).join(','))
    ].join('\r\n');

    await fs.writeFile(exportPath, `\uFEFF${csv}`, 'utf8');
    console.log(`订单 CSV 报表导出成功: ${exportPath}`);
    console.log(`共导出 ${orders.length} 条订单。`);
};

const parseUserId = (value) => {
    const userId = Number(value);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error('用户 ID 必须是正整数。示例: node cli/trade-cli.js ban-user 3');
    }
    return userId;
};

const banUser = async () => {
    const userId = parseUserId(args[0]);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
        console.error(`用户不存在: id=${userId}`);
        process.exitCode = 1;
        return;
    }

    if (user.role === 'ADMIN') {
        console.error(`不能封禁管理员账号: ${user.email}`);
        process.exitCode = 1;
        return;
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isBanned: true },
        select: { email: true }
    });

    console.log(`封禁成功: ${updatedUser.email}`);
};

const unbanUser = async () => {
    const userId = parseUserId(args[0]);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
        console.error(`用户不存在: id=${userId}`);
        process.exitCode = 1;
        return;
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isBanned: false },
        select: { email: true }
    });

    console.log(`解封成功: ${updatedUser.email}`);
};

const showStats = async () => {
    const [usersCount, productsCount, ordersCount, reviewsCount, completedOrders] = await Promise.all([
        prisma.user.count(),
        prisma.product.count(),
        prisma.order.count(),
        prisma.review.count(),
        prisma.order.findMany({
            where: { status: 'COMPLETED' },
            include: { product: { select: { priceFiat: true } } }
        })
    ]);

    const completedTradeAmount = completedOrders.reduce((sum, order) => {
        return sum + Number(order.product?.priceFiat || 0);
    }, 0);

    console.table([{
        用户数: usersCount,
        商品数: productsCount,
        订单数: ordersCount,
        已完成订单交易额: toMoney(completedTradeAmount),
        评价数: reviewsCount
    }]);
};

const run = async () => {
    switch (command) {
        case 'help':
            printHelp();
            break;
        case 'products':
            await listProducts();
            break;
        case 'orders':
            await listOrders();
            break;
        case 'export-orders':
            await exportOrders();
            break;
        case 'ban-user':
            await banUser();
            break;
        case 'unban-user':
            await unbanUser();
            break;
        case 'stats':
            await showStats();
            break;
        default:
            console.error(`未知命令: ${command}`);
            printHelp();
            process.exitCode = 1;
    }
};

try {
    await run();
} catch (error) {
    console.error(`执行失败: ${error.message}`);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
