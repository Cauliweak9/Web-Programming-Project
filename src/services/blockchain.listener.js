import { PrismaClient } from '@prisma/client';
import { getAddress } from 'ethers';
import { getWeb3Config } from '../config/app.config.js';
import { ESCROW_ABI } from '../config/escrow.abi.js';

const prisma = new PrismaClient();

export const startBlockchainListener = async () => {
    const config = getWeb3Config();

    if (!config.web3Mode) {
        console.log('[System] WEB3_MODE is FALSE. Running in Web2 simulation mode.');
        return;
    }

    try {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const contract = new ethers.Contract(config.contractAddress, ESCROW_ABI, provider);

        console.log(`[Web3] Blockchain listener started for contract: ${config.contractAddress}`);

        contract.on('FundsLocked', async (orderId, buyer, seller, amount, event) => {
            const parsedOrderId = Number(orderId);
            console.log(`[Web3] FundsLocked event received. Order ID: ${parsedOrderId}`);
            try {
                await prisma.order.update({
                    where: { id: parsedOrderId },
                    data: {
                        status: 'LOCKED',
                        txHash: event.log.transactionHash,
                        lockTxHash: event.log.transactionHash,
                        buyerAddress: getAddress(buyer),
                        sellerAddress: getAddress(seller),
                        chainId: config.chainId,
                        contractAddress: config.contractAddress
                    }
                });
                console.log(`[Web3] Order ${parsedOrderId} updated to LOCKED.`);
            } catch (dbError) {
                console.error('[Web3] Failed to update order status:', dbError);
            }
        });

        contract.on('OrderShipped', async (orderId, event) => {
            await prisma.order.update({
                where: { id: Number(orderId) },
                data: { status: 'SHIPPED', shipTxHash: event.log.transactionHash }
            }).catch((error) => console.error('[Web3] Failed to sync OrderShipped:', error));
        });

        contract.on('FundsReleased', async (orderId, event) => {
            await prisma.order.update({
                where: { id: Number(orderId) },
                data: { status: 'COMPLETED', completeTxHash: event.log.transactionHash }
            }).catch((error) => console.error('[Web3] Failed to sync FundsReleased:', error));
        });

        contract.on('DisputeRaised', async (orderId, raisedBy, event) => {
            await prisma.order.update({
                where: { id: Number(orderId) },
                data: { status: 'DISPUTED', disputeTxHash: event.log.transactionHash }
            }).catch((error) => console.error('[Web3] Failed to sync DisputeRaised:', error));
        });

        contract.on('DisputeResolved', async (orderId, buyerShare, sellerShare, event) => {
            await prisma.order.update({
                where: { id: Number(orderId) },
                data: {
                    status: buyerShare > 0n && sellerShare === 0n ? 'REFUNDED' : 'RELEASED',
                    arbitrationTxHash: event.log.transactionHash
                }
            }).catch((error) => console.error('[Web3] Failed to sync DisputeResolved:', error));
        });
    } catch (error) {
        console.error('[Web3] Failed to initialize blockchain listener. Check config.ini RPC_URL, CONTRACT_ADDRESS and Anvil.');
    }
};
