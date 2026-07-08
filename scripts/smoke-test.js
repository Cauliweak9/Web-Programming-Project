import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let passed = 0;

const ok = (name, detail = '') => {
    passed += 1;
    console.log(`PASS ${name}${detail ? ` - ${detail}` : ''}`);
};

const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const parseJson = (text, name) => {
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`${name} did not return JSON: ${text.slice(0, 200)}`);
    }
};

const request = async (name, method, url, { token, body } = {}) => {
    const response = await fetch(`${baseUrl}${url}`, {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${name} ${response.status}: ${text.slice(0, 300)}`);
    ok(name, String(response.status));
    return text ? parseJson(text, name) : null;
};

const runCommand = (name, command, args) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, shell: false, env: process.env });
    let output = '';
    const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`${name} timed out`));
    }, 30000);

    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) reject(new Error(`${name} exited ${code}:\n${output}`));
        else {
            ok(name);
            resolve(output);
        }
    });
});

const rpc = async (rpcUrl, method, params = []) => {
    const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const payload = await response.json();
    if (payload.error) throw new Error(`${method}: ${JSON.stringify(payload.error)}`);
    return payload.result;
};

const testApiAndSkill = async () => {
    const adminLogin = await request('api admin login', 'POST', '/api/auth/login', {
        body: { email: 'admin@test.com', password: '123456' }
    });
    const buyerLogin = await request('api buyer login', 'POST', '/api/auth/login', {
        body: { email: 'buyer@test.com', password: '123456' }
    });
    assert(adminLogin.token && buyerLogin.token, 'login token missing');

    const adminMe = await request('api admin me', 'GET', '/api/auth/me', { token: adminLogin.token });
    await request('api buyer me', 'GET', '/api/auth/me', { token: buyerLogin.token });
    const products = await request('api products list', 'GET', '/api/products');
    assert(products.products?.length >= 1, 'product list is empty');
    await request('api product detail', 'GET', `/api/products/${products.products[0].id}`);
    await request('api buyer orders', 'GET', '/api/orders', { token: buyerLogin.token });
    await request('api admin stats', 'GET', '/api/admin/stats', { token: adminLogin.token });
    await request('api admin users', 'GET', '/api/admin/users', { token: adminLogin.token });
    await request('skill credit evaluate', 'POST', '/api/skills/credit-evaluate', { body: { userId: 2 } });
    const web3 = await request('api web3 config', 'GET', '/api/web3/config');
    await request('api wallet bind message', 'GET', '/api/web3/bind-message?address=0x70997970C51812dc3A010C7d01b50e0d17dc79C8', {
        token: buyerLogin.token
    });

    return { web3, adminMe };
};

const testWeb3 = async ({ web3, adminMe }) => {
    assert(typeof web3.web3Mode === 'boolean', 'web3Mode missing');
    if (!web3.web3Mode) return ok('web3 chain', 'skipped: WEB3_MODE is false');

    assert(web3.rpcUrl && web3.contractAddress, 'web3 config is incomplete');
    const chainId = await rpc(web3.rpcUrl, 'eth_chainId');
    assert(Number.parseInt(chainId, 16) === web3.chainId, `chain id mismatch: ${chainId}`);
    ok('anvil rpc chain id', String(web3.chainId));

    const contract = new ethers.Contract(web3.contractAddress, ['function arbiter() view returns (address)'], new ethers.JsonRpcProvider(web3.rpcUrl));
    const arbiter = await contract.arbiter();
    assert(ethers.isAddress(arbiter), 'arbiter is not an address');
    if (adminMe.walletAddress) {
        assert(arbiter.toLowerCase() === adminMe.walletAddress.toLowerCase(), 'arbiter does not match admin wallet');
    }
    ok('escrow arbiter', arbiter);
};

const testCli = async () => {
    await runCommand('cli help', npmCmd, ['run', 'cli', '--', 'help']);
    await runCommand('cli products', npmCmd, ['run', 'cli', '--', 'products']);
    await runCommand('cli orders', npmCmd, ['run', 'cli', '--', 'orders']);
    await runCommand('cli stats', npmCmd, ['run', 'cli', '--', 'stats']);
    await runCommand('cli export-orders', npmCmd, ['run', 'cli', '--', 'export-orders']);
    await fs.access(path.join(root, 'exports', 'orders-report.csv'));
    ok('cli export file');
};

const testMcp = async () => {
    if (!process.env.MCP_URL) {
        ok('mcp endpoint', 'skipped: MCP_URL not set; REST Skill was tested');
        return;
    }
    const response = await fetch(process.env.MCP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream'
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'campus-smoke-test', version: '1.0.0' }
            }
        })
    });
    assert(response.status < 500, `MCP initialize failed with ${response.status}`);
    ok('mcp initialize', String(response.status));
};

try {
    const context = await testApiAndSkill();
    await testWeb3(context);
    await testCli();
    await testMcp();
    console.log(`Smoke test passed: ${passed} checks`);
} catch (error) {
    console.error(`Smoke test failed: ${error.message}`);
    process.exit(1);
}
