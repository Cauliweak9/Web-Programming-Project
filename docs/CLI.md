# 校园二手交易平台 CLI 工具

CLI 工具位于 `cli/trade-cli.js`，直接使用 Prisma Client 访问数据库，适合在 Windows PowerShell 中快速查看数据、导出报表和管理用户封禁状态。

## 运行方式

```bash
npm run cli -- help
```

也可以直接运行：

```bash
node cli/trade-cli.js help
```

## 命令列表

### 查看帮助

```bash
npm run cli -- help
```

显示所有可用命令和示例。

### 查看商品列表

```bash
npm run cli -- products
```

最多显示前 20 条商品，按 `id` 升序，包含商品 id、标题、分类、价格、是否在售、卖家邮箱或昵称。

### 查看订单列表

```bash
npm run cli -- orders
```

最多显示前 20 条订单，按创建时间倒序，包含订单 id、商品标题、买家、卖家、状态、金额、创建时间。

### 导出订单 CSV

```bash
npm run cli -- export-orders
```

导出文件位置：

```text
exports/orders-report.csv
```

CSV 字段：

```text
orderId, productTitle, buyerEmail, sellerEmail, status, amount, createdAt
```

### 封禁用户

```bash
npm run cli -- ban-user 3
```

将指定普通用户的 `isBanned` 设置为 `true`。管理员账号不能被封禁。

### 解封用户

```bash
npm run cli -- unban-user 3
```

将指定用户的 `isBanned` 设置为 `false`。

### 查看统计数据

```bash
npm run cli -- stats
```

输出用户数、商品数、订单数、已完成订单交易额、评价数。

## 注意事项

- CLI 不修改数据库结构。
- CLI 不调用后端 API，而是直接通过 Prisma Client 操作数据库。
- 运行前需要确保 `.env` 中的 `DATABASE_URL` 可用。
- 如果 Prisma Client 不是最新，可以先运行 `npx prisma generate`。
