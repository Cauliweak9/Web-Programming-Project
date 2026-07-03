# 校园二手交易平台 Campus Second-hand Trading Platform

## 1. 项目概述

本项目是《Web 编程》课程大作业题目二“校园二手交易平台”的设计与实现。系统面向校园内二手物品交易场景，支持普通用户发布商品、浏览商品、搜索筛选、下单交易、模拟付款、确认发货、确认收货、交易评价与信誉展示；管理员可以进行用户管理、商品审核、举报处理、订单仲裁、评价管理和数据统计。

项目在原有 Web3 Escrow 担保交易 Demo 的基础上进行了课程化扩展，将原本的订单担保交易流程完善为一个具备真实后端、RESTful API、CLI 工具和开放 Skill 的校园二手交易平台。

## 2. 技术栈

- 前端：HTML5 + CSS3 + JavaScript + Vue 3 CDN + Tailwind CSS CDN
- 后端：Node.js + Express
- 数据库：PostgreSQL
- ORM：Prisma
- 认证：JWT + bcrypt
- API：RESTful API + CORS
- CLI：Node.js 命令行工具
- Skill：基于 API 的信誉评估 Skill
- Web3：保留 Solidity / Escrow 合约相关目录，课程演示默认使用 Web2 模拟交易模式

## 3. 项目目录结构

```text
/root
├── public/                  # 前端页面
│   ├── index.html           # 商品大厅 / 首页
│   ├── login.html           # 登录页
│   ├── register.html        # 注册页
│   ├── profile.html         # 个人信息页
│   ├── publish-product.html # 发布商品页
│   ├── my-products.html     # 我的发布
│   ├── product-detail.html  # 商品详情
│   ├── dashboard.html       # 我的订单
│   ├── review.html          # 评价页面
│   ├── user-profile.html    # 用户信誉主页
│   ├── admin.html           # 管理员后台
│   ├── third-party-demo.html# 开放 API 调用示例
│   ├── skill-demo.html      # 信誉评估 Skill 示例
│   └── demo-hub.html        # 答辩功能导航页
├── src/
│   ├── controllers/         # 后端控制器
│   ├── routes/              # API 路由
│   ├── middlewares/         # JWT / 管理员鉴权
│   ├── services/            # Web3 监听相关服务
│   └── app.js               # Express 入口
├── prisma/
│   ├── schema.prisma        # 数据库模型
│   └── seed.js              # 演示数据脚本
├── cli/
│   └── trade-cli.js         # CLI 管理工具
├── docs/
│   ├── API.md               # RESTful API 文档
│   └── CLI.md               # CLI 使用说明
├── contracts/               # Solidity 合约
├── config.ini               # Web2 / Web3 模式配置
├── package.json
└── README.md