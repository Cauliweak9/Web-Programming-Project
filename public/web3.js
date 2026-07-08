(function () {
    const API_BASE = window.location.origin;

    async function requestJson(url, options = {}) {
        const res = await fetch(`${API_BASE}${url}`, options);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || '请求失败');
        return data;
    }

    async function config() {
        if (!window.__web3Config) window.__web3Config = await requestJson('/api/web3/config');
        return window.__web3Config;
    }

    function requireWallet() {
        if (!window.ethereum) throw new Error('请先安装 MetaMask 或兼容钱包');
        if (!window.ethers) throw new Error('ethers 前端库未加载');
    }

    async function signer() {
        requireWallet();
        const cfg = await config();
        const chainHex = `0x${Number(cfg.chainId).toString(16)}`;

        try {
            await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainHex }] });
        } catch (error) {
            if (error.code !== 4902) throw error;
            await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: chainHex,
                    chainName: cfg.chainName,
                    rpcUrls: [cfg.rpcUrl],
                    nativeCurrency: { name: cfg.currencySymbol, symbol: cfg.currencySymbol, decimals: 18 }
                }]
            });
        }

        await ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.BrowserProvider(ethereum);
        return provider.getSigner();
    }

    async function contract() {
        const cfg = await config();
        if (!cfg.contractAddress) throw new Error('后端尚未配置合约地址');
        return new ethers.Contract(cfg.contractAddress, cfg.escrowAbi, await signer());
    }

    async function bindWallet(token) {
        const account = await signer();
        const address = await account.getAddress();
        const data = await requestJson(`/api/web3/bind-message?address=${encodeURIComponent(address)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const signature = await account.signMessage(data.message);
        return requestJson('/api/auth/wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ address, signature })
        });
    }

    async function lockFunds(order) {
        const escrow = await contract();
        const tx = await escrow.lockFunds(order.id, order.sellerAddress || order.seller?.walletAddress, {
            value: ethers.parseEther(String(order.cryptoAmount))
        });
        await tx.wait();
        return tx.hash;
    }

    async function updateOrder(order, status) {
        const escrow = await contract();
        const method = { SHIPPED: 'shipOrder', COMPLETED: 'confirmReceipt', DISPUTED: 'raiseDispute' }[status];
        if (!method) throw new Error('不支持的链上订单操作');
        const tx = await escrow[method](order.id);
        await tx.wait();
        return tx.hash;
    }

    async function resolveDispute(order, decision) {
        const escrow = await contract();
        const amount = ethers.parseEther(String(order.cryptoAmount));
        const buyerShare = decision === 'REFUND' ? amount : 0n;
        const sellerShare = decision === 'RELEASE' ? amount : 0n;
        const tx = await escrow.resolveDispute(order.id, buyerShare, sellerShare);
        await tx.wait();
        return tx.hash;
    }

    async function transferArbiter(address) {
        const escrow = await contract();
        const tx = await escrow.transferArbiter(address);
        await tx.wait();
        return tx.hash;
    }

    window.Web3Trade = { config, bindWallet, lockFunds, updateOrder, resolveDispute, transferArbiter };
}());
