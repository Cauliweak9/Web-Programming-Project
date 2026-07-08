import { getAddress, Interface, JsonRpcProvider, parseEther, verifyMessage } from 'ethers';
import { getWeb3Config } from '../config/app.config.js';
import { ESCROW_ABI } from '../config/escrow.abi.js';

const iface = new Interface(ESCROW_ABI);

export const walletBindMessage = (userId, address) =>
    `Campus Secondhand Trade wallet binding\nUser ID: ${userId}\nAddress: ${getAddress(address)}`;

export const verifyWalletSignature = (userId, address, signature) =>
    getAddress(verifyMessage(walletBindMessage(userId, address), signature)) === getAddress(address);

const sameAddress = (a, b) => a && b && getAddress(a) === getAddress(b);
const sameOrder = (event, orderId) => event && BigInt(event.args.orderId) === BigInt(orderId);

function assertWeb3Ready() {
    const config = getWeb3Config();
    if (!config.web3Mode) throw new Error('当前未启用 WEB3_MODE');
    if (!config.contractAddress) throw new Error('请先在 config.ini 配置 CONTRACT_ADDRESS');
    return config;
}

function parseLogs(receipt, contractAddress) {
    return receipt.logs
        .filter((log) => sameAddress(log.address, contractAddress))
        .map((log) => {
            try {
                return iface.parseLog(log);
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean);
}

function expectAddress(actual, expected, label) {
    if (!expected || !sameAddress(actual, expected)) throw new Error(`${label} 地址与链上交易不匹配`);
}

export async function verifyEscrowEvent({ order, action, txHash, buyerShare, sellerShare }) {
    const config = assertWeb3Ready();
    const provider = new JsonRpcProvider(config.rpcUrl);
    const receipt = await provider.waitForTransaction(txHash, 1, 15000);

    if (!receipt || receipt.status !== 1) throw new Error('链上交易未成功确认');
    if (!receipt.to || !sameAddress(receipt.to, config.contractAddress)) throw new Error('交易目标不是当前托管合约');

    const events = parseLogs(receipt, config.contractAddress);
    const event = (name) => events.find((item) => item.name === name && sameOrder(item, order.id));
    const buyer = order.buyerAddress || order.buyer?.walletAddress;
    const seller = order.sellerAddress || order.seller?.walletAddress;

    if (action === 'LOCK') {
        const locked = event('FundsLocked');
        if (!locked) throw new Error('未找到 FundsLocked 事件');
        expectAddress(locked.args.buyer, buyer, '买家');
        expectAddress(locked.args.seller, seller, '卖家');
        if (locked.args.amount !== parseEther(String(order.cryptoAmount))) throw new Error('链上锁定金额与订单金额不一致');
        return { receipt, event: locked, config };
    }

    if (action === 'SHIP') {
        const shipped = event('OrderShipped');
        if (!shipped) throw new Error('未找到 OrderShipped 事件');
        expectAddress(receipt.from, seller, '卖家');
        return { receipt, event: shipped, config };
    }

    if (action === 'COMPLETE') {
        const released = event('FundsReleased');
        if (!released) throw new Error('未找到 FundsReleased 事件');
        expectAddress(receipt.from, buyer, '买家');
        return { receipt, event: released, config };
    }

    if (action === 'DISPUTE') {
        const disputed = event('DisputeRaised');
        if (!disputed) throw new Error('未找到 DisputeRaised 事件');
        expectAddress(disputed.args.raisedBy, buyer, '争议发起人');
        return { receipt, event: disputed, config };
    }

    if (action === 'ARBITRATE') {
        const resolved = event('DisputeResolved');
        if (!resolved) throw new Error('未找到 DisputeResolved 事件');
        if (buyerShare !== undefined && resolved.args.buyerShare !== BigInt(buyerShare)) throw new Error('买家分账金额不一致');
        if (sellerShare !== undefined && resolved.args.sellerShare !== BigInt(sellerShare)) throw new Error('卖家分账金额不一致');
        return { receipt, event: resolved, config };
    }

    throw new Error('不支持的链上操作');
}
