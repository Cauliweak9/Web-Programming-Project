import fs from 'fs';
import path from 'path';

function readIni() {
    const file = path.resolve(process.cwd(), 'config.ini');
    if (!fs.existsSync(file)) return {};

    return fs.readFileSync(file, 'utf8').split(/\r?\n/).reduce((config, rawLine) => {
        const line = rawLine.split('#')[0].trim();
        if (!line || line.startsWith('[')) return config;

        const match = line.match(/^([^=]+)=(.*)$/);
        if (!match) return config;

        config[match[1].trim().toUpperCase()] = match[2].trim();
        return config;
    }, {});
}

const truthy = (value) => String(value || '').trim().toUpperCase() === 'TRUE';
const firstValue = (ini, key, fallback = '') => process.env[key] ?? ini[key] ?? fallback;

export function getWeb3Config() {
    const ini = readIni();
    const chainId = Number(firstValue(ini, 'CHAIN_ID', '31337'));

    return {
        web3Mode: truthy(firstValue(ini, 'WEB3_MODE', 'FALSE')),
        rpcUrl: firstValue(ini, 'RPC_URL', 'http://127.0.0.1:8545'),
        chainId: Number.isFinite(chainId) ? chainId : 31337,
        chainName: firstValue(ini, 'CHAIN_NAME', 'Anvil Local'),
        currencySymbol: firstValue(ini, 'CURRENCY_SYMBOL', 'ETH'),
        contractAddress: firstValue(ini, 'CONTRACT_ADDRESS', ''),
        demoEthPrice: Number(firstValue(ini, 'DEMO_ETH_PRICE', '20000')) || 20000
    };
}
