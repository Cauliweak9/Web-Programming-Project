import { getWeb3Config } from '../config/app.config.js';
import { ESCROW_ABI } from '../config/escrow.abi.js';
import { walletBindMessage } from '../services/web3.service.js';

export const getPublicWeb3Config = (req, res) => {
    const config = getWeb3Config();

    res.json({
        web3Mode: config.web3Mode,
        rpcUrl: config.rpcUrl,
        chainId: config.chainId,
        chainName: config.chainName,
        currencySymbol: config.currencySymbol,
        contractAddress: config.contractAddress,
        demoEthPrice: config.demoEthPrice,
        escrowAbi: ESCROW_ABI
    });
};

export const getWalletBindMessage = (req, res) => {
    try {
        const { address } = req.query;
        if (!address) return res.status(400).json({ error: 'address 参数不能为空' });
        res.json({ message: walletBindMessage(req.user.userId, address) });
    } catch (error) {
        res.status(400).json({ error: '钱包地址格式不正确' });
    }
};
