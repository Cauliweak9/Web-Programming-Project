import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function getWeb3Mode() {
    try {
        const iniPath = path.resolve(process.cwd(), 'config.ini');
        if (!fs.existsSync(iniPath)) return false;

        const content = fs.readFileSync(iniPath, 'utf8');
        const line = content
            .split(/\r?\n/)
            .map((item) => item.trim())
            .find((item) => item && !item.startsWith('#') && /^WEB3_MODE\s*=/.test(item));

        if (!line) return false;
        const value = line.split('=')[1]?.trim().toUpperCase();
        return value === 'TRUE';
    } catch (e) {
        return false;
    }
}

export const startBlockchainListener = async () => {
    const isWeb3Mode = getWeb3Mode();

    if (!isWeb3Mode) {
        console.log('[System] WEB3_MODE is FALSE. Running in Web2 simulation mode.');
        return;
    }

    try {
        const { ethers } = await import('ethers');
        const contractJsonPath = path.resolve(process.cwd(), './out/MarketplaceEscrow.sol/MarketplaceEscrow.json');
        const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
        const abi = contractJson.abi;

        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, provider);

        console.log(`[Web3] Blockchain listener started for contract: ${process.env.CONTRACT_ADDRESS}`);

        contract.on('FundsLocked', async (orderId, buyer, seller, amount, event) => {
            const parsedOrderId = Number(orderId);
            console.log(`[Web3] FundsLocked event received. Order ID: ${parsedOrderId}`);
            try {
                await prisma.order.update({
                    where: { id: parsedOrderId },
                    data: { status: 'LOCKED', txHash: event.log.transactionHash }
                });
                console.log(`[Web3] Order ${parsedOrderId} updated to LOCKED.`);
            } catch (dbError) {
                console.error('[Web3] Failed to update order status:', dbError);
            }
        });
    } catch (error) {
        console.error('[Web3] Failed to initialize blockchain listener. Check RPC_URL, CONTRACT_ADDRESS and Anvil.');
    }
};
