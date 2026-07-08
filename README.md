# 校园二手交易平台

面向校园闲置物品交易的 Web 编程课程项目。系统包含用户登录、商品发布、搜索筛选、订单流转、评价信誉、举报后台、开放 API、CLI 工具、信誉评估 Skill，并扩展了基于 Anvil EVM 链的 Web3 托管交易。

## 技术栈

- 前端：HTML + JavaScript + Vue 3 浏览器版 + Tailwind CSS CDN
- 后端：Node.js + Express
- 数据库：PostgreSQL + Prisma
- 认证：JWT + bcrypt
- Web3：Solidity + Foundry Docker + ethers.js + Anvil
- 扩展：RESTful API、CLI、开放 Skill

## 一键 Web3 演示

确保 Docker、PostgreSQL 和 `.env` 中的 `DATABASE_URL` 可用，然后执行：

```powershell
.\scripts\init-web3-demo.ps1
```

脚本会完成：

- 同步 Prisma schema 并重置演示数据，自增 ID 从 1 开始
- 启动 Osaka hardfork 的 Anvil 链，默认宿主端口 `8546`
- 编译并部署 `MarketplaceEscrow`
- 写入 `config.ini`，开启 `WEB3_MODE = TRUE`
- 启动 `npm run dev`

访问：

```text
http://localhost:3000/index.html
```

测试账号：

```text
admin@test.com  / 123456
seller@test.com / 123456
buyer@test.com  / 123456
```

默认演示钱包：

```text
admin  0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
seller 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
buyer  0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

管理员仲裁地址由部署脚本写入合约 `arbiter`，默认是 admin 钱包；如需改动可设置 `ARBITER_ADDRESS` 后重新运行初始化脚本。

```
$env:ARBITER_ADDRESS="0x你的管理员地址"
.\scripts\init-web3-demo.ps1
```

## 普通启动

```bash
npm install
npx prisma db push
npm run seed
npm run dev
```

若只想使用 Web2 模拟付款，将 `config.ini` 中 `WEB3_MODE` 改为 `FALSE`。

## 常用页面

- 商品大厅：`/index.html`
- 发布商品：`/publish-product.html`
- 我的发布：`/my-products.html`
- 我的订单：`/dashboard.html`
- 个人信息：`/profile.html`
- 后台管理：`/admin.html`
- API 示例：`/third-party-demo.html`
- Skill 示例：`/skill-demo.html`

## CLI

```bash
npm run cli -- help
npm run cli -- products
npm run cli -- orders
npm run cli -- export-orders
npm run cli -- ban-user 3
npm run cli -- stats
```

## Smoke Test

服务启动后运行：

```bash
npm run smoke
```

脚本会检查登录、商品、订单、后台、Skill、Web3 配置、Anvil RPC、合约 arbiter、CLI 和订单导出。项目当前没有独立 MCP 服务；如后续接入，可设置 `MCP_URL` 后让脚本额外执行 MCP `initialize` 检查。

## 文档

- API 文档：`docs/API.md`
- CLI 文档：`docs/CLI.md`
- Web3 合约：`contracts/MarketplaceEscrow.sol`
- 初始化脚本：`scripts/init-web3-demo.ps1`
