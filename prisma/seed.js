import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_EMAILS = ['admin@test.com', 'seller@test.com', 'buyer@test.com'];

const demoProducts = [
    {
        title: '高等数学教材 同济第七版',
        description: '课程结束后闲置，重点页有少量铅笔标注，适合期末复习。',
        category: '教材资料',
        priceFiat: 25,
        condition: '八成新'
    },
    {
        title: 'C 语言程序设计实验指导书',
        description: '计算机基础课配套资料，附带常用实验题记录。',
        category: '教材资料',
        priceFiat: 18,
        condition: '九成新'
    },
    {
        title: '宿舍折叠小桌',
        description: '可放笔记本电脑，适合床上学习和临时办公。',
        category: '宿舍用品',
        priceFiat: 35,
        condition: '七成新'
    },
    {
        title: '二手山地自行车',
        description: '校内通勤使用，刹车正常，车铃和车锁一起送。',
        category: '交通出行',
        priceFiat: 280,
        condition: '七成新'
    },
    {
        title: '台式显示器 24 英寸',
        description: '1080p 屏幕，适合写代码、看网课和做课程设计。',
        category: '电子数码',
        priceFiat: 320,
        condition: '八成新'
    },
    {
        title: '蓝牙耳机',
        description: '续航正常，适合图书馆自习和跑步使用。',
        category: '电子数码',
        priceFiat: 88,
        condition: '八成新'
    },
    {
        title: '宿舍小台灯',
        description: '三档亮度，USB 供电，晚上学习不打扰室友。',
        category: '宿舍用品',
        priceFiat: 22,
        condition: '九成新'
    },
    {
        title: '考研英语真题资料',
        description: '近年真题册和解析册，适合备考同学刷题。',
        category: '考试资料',
        priceFiat: 45,
        condition: '八成新'
    }
];

const demoOrders = [
    { productIndex: 0, status: 'PENDING', cryptoAmount: '0.0100', txHash: null },
    { productIndex: 1, status: 'LOCKED', cryptoAmount: '0.0072', txHash: '0x_demo_locked_001' },
    { productIndex: 2, status: 'SHIPPED', cryptoAmount: '0.0140', txHash: '0x_demo_shipped_001' },
    { productIndex: 3, status: 'COMPLETED', cryptoAmount: '0.1120', txHash: '0x_demo_completed_001' },
    { productIndex: 4, status: 'DISPUTED', cryptoAmount: '0.1280', txHash: '0x_demo_disputed_001' }
];

const demoReviews = [
    {
        rating: 5,
        content: '卖家回复很快，教材保存得不错，线下交接也很准时。'
    },
    {
        rating: 4,
        content: '显示器整体没问题，包装很仔细，价格也比较合适。'
    },
    {
        rating: 2,
        content: '买家临时改了两次交接时间，希望之后沟通更稳定。'
    }
];

async function clearDemoData() {
    const demoUsers = await prisma.user.findMany({
        where: { email: { in: DEMO_EMAILS } },
        select: { id: true }
    });
    const demoUserIds = demoUsers.map((user) => user.id);

    const demoProductTitles = demoProducts.map((product) => product.title);
    const demoProductRows = await prisma.product.findMany({
        where: {
            OR: [
                { title: { in: demoProductTitles } },
                demoUserIds.length > 0 ? { sellerId: { in: demoUserIds } } : undefined
            ].filter(Boolean)
        },
        select: { id: true }
    });
    const demoProductIds = demoProductRows.map((product) => product.id);

    const orderDeleteConditions = [
        demoUserIds.length > 0 ? { buyerId: { in: demoUserIds } } : undefined,
        demoUserIds.length > 0 ? { sellerId: { in: demoUserIds } } : undefined,
        demoProductIds.length > 0 ? { productId: { in: demoProductIds } } : undefined
    ].filter(Boolean);

    if (orderDeleteConditions.length > 0) {
        await prisma.order.deleteMany({
            where: { OR: orderDeleteConditions }
        });
    }

    const reviewDeleteConditions = [
        demoUserIds.length > 0 ? { reviewerId: { in: demoUserIds } } : undefined,
        demoUserIds.length > 0 ? { revieweeId: { in: demoUserIds } } : undefined
    ].filter(Boolean);

    if (reviewDeleteConditions.length > 0) {
        await prisma.review.deleteMany({
            where: { OR: reviewDeleteConditions }
        });
    }

    await prisma.product.deleteMany({
        where: {
            OR: [
                { title: { in: demoProductTitles } },
                demoUserIds.length > 0 ? { sellerId: { in: demoUserIds } } : undefined
            ].filter(Boolean)
        }
    });

    await prisma.user.deleteMany({
        where: { email: { in: DEMO_EMAILS } }
    });
}

async function main() {
    console.log('Starting campus marketplace demo seed...');

    await clearDemoData();
    console.log('Old demo data cleared.');

    const passwordHash = await bcrypt.hash('123456', 10);

    const admin = await prisma.user.create({
        data: {
            email: 'admin@test.com',
            passwordHash,
            nickname: '答辩管理员',
            role: 'ADMIN',
            creditRating: 100
        }
    });

    const seller = await prisma.user.create({
        data: {
            email: 'seller@test.com',
            passwordHash,
            nickname: '校园卖家',
            role: 'USER',
            creditRating: 103
        }
    });

    const buyer = await prisma.user.create({
        data: {
            email: 'buyer@test.com',
            passwordHash,
            nickname: '校园买家',
            role: 'USER',
            creditRating: 95
        }
    });

    const products = [];
    for (const [index, product] of demoProducts.entries()) {
        products.push(
            await prisma.product.create({
                data: {
                    ...product,
                    sellerId: seller.id,
                    isAvailable: !demoOrders.some((order) => order.productIndex === index)
                }
            })
        );
    }

    const orders = [];
    for (const order of demoOrders) {
        orders.push(
            await prisma.order.create({
                data: {
                    status: order.status,
                    cryptoAmount: order.cryptoAmount,
                    txHash: order.txHash,
                    productId: products[order.productIndex].id,
                    buyerId: buyer.id,
                    sellerId: seller.id
                }
            })
        );
    }

    await prisma.review.createMany({
        data: [
            {
                rating: demoReviews[0].rating,
                content: demoReviews[0].content,
                reviewerId: buyer.id,
                revieweeId: seller.id
            },
            {
                rating: demoReviews[1].rating,
                content: demoReviews[1].content,
                reviewerId: buyer.id,
                revieweeId: seller.id
            },
            {
                rating: demoReviews[2].rating,
                content: demoReviews[2].content,
                reviewerId: seller.id,
                revieweeId: buyer.id
            }
        ]
    });

    console.log('Demo seed finished.');
    console.log('');
    console.log('Accounts:');
    console.log('  admin@test.com  / 123456 / ADMIN');
    console.log('  seller@test.com / 123456 / USER');
    console.log('  buyer@test.com  / 123456 / USER');
    console.log('');
    console.log('Created:');
    console.log(`  Users: 3`);
    console.log(`  Products: ${products.length}`);
    console.log(`  Orders: ${orders.length} (PENDING, LOCKED, SHIPPED, COMPLETED, DISPUTED)`);
    console.log(`  Reviews: ${demoReviews.length}`);
    console.log('');
    console.log('Credit ratings after seeded reviews:');
    console.log(`  ${seller.email}: ${seller.creditRating}`);
    console.log(`  ${buyer.email}: ${buyer.creditRating}`);
    console.log('');
    console.log('Run the app with: npm run dev');
    console.log('Open: http://localhost:3000/login.html');
}

main()
    .catch((error) => {
        console.error('Seed failed.');
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
