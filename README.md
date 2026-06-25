# 🚀 Web3 担保交易系统 (Escrow System) 交接文档

## 1. 项目概述

本项目是一个基于 Node.js/Express 和 Vue 3 的担保交易平台。核心逻辑通过订单状态机管理交易流转，并引入了“管理员上帝视角”进行仲裁控制，模拟了真实的 Web3 去中心化交易中 Escrow 合约的运作流程。

> **目前没有完全测试好Web3智能合约这块的功能**

## 2. 目录结构

```
/root
├── public/             # 前端页面 (HTML + Vue 3 CDN)
│   ├── index.html      # 交易大厅 (买家视角)
│   ├── login.html      # 登录页
│   ├── register.html   # 注册页
│   ├── dashboard.html  # 个人订单中心
│   └── admin.html      # 系统仲裁控制台
├── src/                # 后端源码
│   ├── controllers/    # 业务逻辑 (订单、Admin、Auth)
│   ├── middlewares/    # 鉴权中间件 (JWT + Role)
│   ├── routes/         # API 路由映射
│   └── app.js          # 入口文件
├── prisma/             # 数据库 schema
└── package.json        # 依赖项
└── config.ini			# 控制Web2模拟交易/Web3合约交易
```

## 3. 环境与依赖

- **安装依赖**: `npm install`
- **启动环境**: 请确保本地已运行 MySQL/PostgreSQL 数据库。
- **启动服务**: `npm start` (或 `nodemon index.js`)

## 4. 关键开发操作指南

### 数据库结构更新 (Migration)

如果后续需要新增数据库字段（例如增加 `user.walletAddress`），请按以下流程操作：

1. 修改 `prisma/schema.prisma` 文件。
2. 运行生成命令：`npx prisma migrate dev --name <更新描述>`。
3. 同步 Client：`npx prisma generate`。

## 5. 系统核心流转逻辑

交易状态机设计如下，通过 `PATCH /api/orders/:orderId/status` 接口流转：

- **PENDING (待付款)** $\rightarrow$ **LOCKED (锁仓中)** $\rightarrow$ **SHIPPED (已发货)** $\rightarrow$ **COMPLETED (成交)**
- **DISPUTED (纠纷中)** $\rightarrow$ **RELEASED / REFUNDED (仲裁完结)**

## 6. 已实现功能清单

- **全栈认证系统**: 支持基于 JWT 的用户登录、注册及角色隔离 (USER/ADMIN)。
- **交易大厅**: 商品展示、基于分页逻辑的获取接口。
- **订单生命周期**: 完整的从下单到收货的业务流程。
- **管理员仲裁模块**: 具备上帝视角的订单全盘监控，支持对 `DISPUTED` 状态的订单进行强行放款或退款。

> 简单来说就是模块1~6都基本做完了，其中模块2（商品发布&管理）暂时没有添加图片上传功能，模块4（评价&信誉）有后端实现，前端没有实现

## 7. 待补充模块 (Next Steps)

###  模块七：CLI或MCP集成（二选一）

CLI模式：开发命令行工具（如trade-cli），支持至少3个管理操作（如查看商品列表、导出订单报表、封禁用户）。

MCP集成：实现Model

Context Protocol Server，暴露至少3个工具（如搜索商品、获取详情、创建订单），并提供配置说明供AI代理调用。

###  模块八：开放Skill

设计并实现至少一个Skill（可被外部系统通过API或MCP调用的独立功能单元）。示例（任选其一或自定）：

智能推荐Skill：根据用户浏览历史推荐相似商品。

自动定价Skill：基于分类、成色、市场均价给出建议售价。

信誉评估Skill：计算用户信誉分并提供改进建议。

Skill需提供清晰的输入输出（JSON格式），通过API端点（如POST /api/skills/recommend）或MCP工具暴露，并附调用文档。

## 8. 遗留问题与优化方向

- **并发安全性**: 目前使用了基本的逻辑检查，在后续高并发场景下，需引入数据库事务（`prisma.$transaction`）来确保资金流转的原子性。
- **前端优化**: 目前所有前端使用单文件 CDN 引入，建议后续使用 `Vite` 构建，引入 `Pinia` 管理状态，并配置 `Axios` 的全局响应拦截器处理 401/403 异常。

> **给接手人的提示**:
>
> 运行项目前请检查 `.env` 文件中的 `DATABASE_URL` 是否配置正确。管理员账户可以通过 `npx prisma studio` 直接在数据库中将用户的 `role` 字段修改为 `ADMIN` 即可获取权限。