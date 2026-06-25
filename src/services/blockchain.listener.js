import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// 简单的 INI 解析函数
function getWeb3Mode() {
    try {
        const iniPath = path.resolve(process.cwd(), 'config.ini');
        if (!fs.existsSync(iniPath)) return true; // 默认开启
        const content = fs.readFileSync(iniPath, 'utf8');
        const match = content.match(/WEB3_MODE\s*=\s*(\w+)/);
        return match ? match[1].toUpperCase() === 'TRUE' : true;
    } catch (e) {
        return true;
    }
}

export const startBlockchainListener = async () => {
    const isWeb3Mode = getWeb3Mode();

    if (!isWeb3Mode) {
        console.log("ℹ️ [系统配置] 当前处于 [Web2 模拟模式]，跳过智能合约事件监听器初始化。");
        return;
    }

    try {
        const { ethers } = await import('ethers');
        const contractJsonPath = path.resolve(process.cwd(), './out/MarketplaceEscrow.sol/MarketplaceEscrow.json');
        const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
        const abi = contractJson.abi;

        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, provider);

        console.log(`🔗 [Web3 模式激活] 链上监听器已启动，正在监控合约: ${process.env.CONTRACT_ADDRESS}`);

        contract.on("FundsLocked", async (orderId, buyer, seller, amount, event) => {
            const parsedOrderId = Number(orderId);
            console.log(`⚡ 捕获到锁仓事件！订单ID: ${parsedOrderId}`);
            try {
                await prisma.order.update({
                    where: { id: parsedOrderId },
                    data: { status: 'LOCKED', txHash: event.log.transactionHash }
                });
                console.log(`✅ 订单 ${parsedOrderId} 状态已更新为 LOCKED`);
            } catch (dbError) {
                console.error(`❌ 数据库更新失败:`, dbError);
            }
        });
    } catch (error) {
        console.error("❌ 链上监听器初始化失败 (请检查 Docker Anvil 是否启动):");
    }
};