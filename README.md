# 校园二手交易平台 Campus Second-hand Trading Platform

这是一个 Web 编程课程项目，面向校园二手物品交易场景。系统支持用户注册登录、商品发布与管理、商品搜索筛选、下单交易、订单状态流转、评价与信誉、后台管理、开放 API、CLI 工具和信誉评估 Skill。

## 技术栈

- 前端：HTML + JavaScript + Vue 3 浏览器版 + Tailwind CSS CDN
- 后端：Node.js + Express
- 数据库：PostgreSQL
- ORM：Prisma
- 认证：JWT + bcrypt
- API：RESTful API + CORS
- CLI：Node.js + Prisma Client
- Skill：基于 REST API 的信誉评估接口

说明：Vue 运行时已放在 `public/vendor/vue.global.prod.js`，页面不再依赖外网 Vue CDN。

## 项目结构

```text
public/                  前端页面
  index.html             商品大厅 / 首页
  login.html             登录页
  register.html          注册页
  profile.html           个人信息页
  publish-product.html   发布商品页
  my-products.html       我的发布
  product-detail.html    商品详情
  dashboard.html         我的订单
  review.html            评价页面
  user-profile.html      用户信誉主页
  admin.html             管理员后台
  third-party-demo.html  开放 API 调用示例
  skill-demo.html        信誉评估 Skill 示例
  demo-hub.html          功能导航页
  nav.js                 统一导航脚本
  vendor/                本地前端运行时依赖

src/
  controllers/           后端控制器
  routes/                API 路由
  middlewares/           JWT / 管理员权限校验
  services/              Web3 监听相关服务
  app.js                 Express 入口

prisma/
  schema.prisma          数据模型
  seed.js                演示数据脚本

cli/
  trade-cli.js           CLI 管理工具

docs/
  API.md                 API 文档
  CLI.md                 CLI 使用说明
```

## 启动方式

安装依赖：

```bash
npm install
```

生成 Prisma Client：

```bash
npx prisma generate
```

同步数据库结构：

```bash
npx prisma db push
```

写入演示数据：

```bash
npm run seed
```

启动项目：

```bash
npm run dev
```

访问：

```text
http://localhost:3000/index.html
```

## 测试账号

```text
admin@test.com  / 123456
seller@test.com / 123456
buyer@test.com  / 123456
```

## 常用页面

- 商品大厅：`/index.html`
- 发布商品：`/publish-product.html`
- 我的发布：`/my-products.html`
- 我的订单：`/dashboard.html`
- 后台管理：`/admin.html`
- 开放 API 示例：`/third-party-demo.html`
- Skill 示例：`/skill-demo.html`
- 功能导航：`/demo-hub.html`

## CLI

```bash
npm run cli -- help
npm run cli -- products
npm run cli -- orders
npm run cli -- export-orders
npm run cli -- ban-user 3
npm run cli -- stats
```

## 编码约定

项目文件统一使用 UTF-8 编码。Windows PowerShell 中写中文文件时不要使用默认 `Set-Content` 覆盖源码，容易因为编码不一致导致乱码。建议使用编辑器保存为 UTF-8，或在 PowerShell 中显式指定 UTF-8：

```powershell
Set-Content -Path file.html -Value $content -Encoding utf8
```

前端页面中的 Vue 运行时使用本地文件 `public/vendor/vue.global.prod.js`，避免外网 CDN 加载失败导致 Vue 模板裸显示。
