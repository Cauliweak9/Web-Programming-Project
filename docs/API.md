# Campus Second-hand Trading API

Base URL: `http://localhost:3000`

All responses are JSON. Protected APIs use:

```http
Authorization: Bearer <token>
```

CORS is enabled in `src/app.js`, so third-party pages can call open APIs directly from a browser.

## Auth

### Register

- Method: `POST`
- URL: `/api/auth/register`
- Description: Create a user account.
- Token: No

Request body:

```json
{
  "email": "buyer@test.com",
  "password": "123456",
  "nickname": "Campus Buyer"
}
```

Response:

```json
{
  "message": "注册成功",
  "userId": 1
}
```

Common errors:

```json
{ "error": "该邮箱已被注册" }
```

### Login

- Method: `POST`
- URL: `/api/auth/login`
- Description: Login and get a JWT.
- Token: No

Request body:

```json
{
  "email": "buyer@test.com",
  "password": "123456"
}
```

Response:

```json
{
  "message": "登录成功",
  "token": "jwt-token",
  "nickname": "Campus Buyer"
}
```

Common errors:

```json
{ "error": "邮箱或密码错误" }
{ "error": "该账号已被管理员封禁，暂时无法登录" }
```

## Products

### List Products

- Method: `GET`
- URL: `/api/products`
- Description: Public marketplace product list. Supports search, category filter, price range, pagination, and sorting.
- Token: No

Query parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `keyword` | string | No | Search title, description, or category |
| `category` | string | No | Exact category filter |
| `minPrice` | number | No | Minimum `priceFiat` |
| `maxPrice` | number | No | Maximum `priceFiat` |
| `page` | number | No | Default `1` |
| `limit` | number | No | Default `10`, max `50` |
| `sortBy` | string | No | `createdAt`, `priceFiat`, `originalPrice`, `title` |
| `sortOrder` | string | No | `asc` or `desc` |

Example:

```http
GET /api/products?keyword=book&category=教材资料&minPrice=10&maxPrice=100
```

Response:

```json
{
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "products": [
    {
      "id": 1,
      "title": "高等数学教材",
      "description": "课程复习资料",
      "category": "教材资料",
      "priceFiat": 25,
      "originalPrice": 59,
      "imageUrl": "https://example.com/book.jpg",
      "condition": "八成新",
      "isAvailable": true,
      "sellerId": 2,
      "seller": {
        "id": 2,
        "nickname": "校园卖家",
        "email": "seller@test.com"
      }
    }
  ]
}
```

Common errors:

```json
{ "error": "获取商品列表失败", "details": "..." }
```

### Product Detail

- Method: `GET`
- URL: `/api/products/:id`
- Description: Get one product and seller information.
- Token: No

Response:

```json
{
  "id": 1,
  "title": "高等数学教材",
  "priceFiat": 25,
  "seller": {
    "id": 2,
    "nickname": "校园卖家",
    "email": "seller@test.com",
    "creditRating": 103
  }
}
```

Common errors:

```json
{ "error": "商品不存在或已被删除" }
```

### Create Product

- Method: `POST`
- URL: `/api/products`
- Description: Seller publishes a product.
- Token: Yes

Request body:

```json
{
  "title": "宿舍台灯",
  "description": "三档亮度，USB 供电",
  "category": "宿舍用品",
  "priceFiat": 22,
  "originalPrice": 49,
  "condition": "九成新",
  "imageUrl": "https://example.com/lamp.jpg"
}
```

Response:

```json
{
  "message": "商品发布成功",
  "product": {
    "id": 10,
    "title": "宿舍台灯"
  }
}
```

Common errors:

```json
{ "error": "拒绝访问：未提供身份令牌" }
{ "error": "请填写完整的商品标题、描述、分类、价格和成色" }
```

### My Products

- Method: `GET`
- URL: `/api/products/my/list`
- Description: Get products published by the current user.
- Token: Yes

### Update Product

- Method: `PUT`
- URL: `/api/products/:id`
- Description: Edit a product. Only the seller can update it.
- Token: Yes

### Delist Product

- Method: `DELETE`
- URL: `/api/products/:id`
- Description: Soft delist a product by setting `isAvailable=false`.
- Token: Yes

### Permanently Delete Product

- Method: `DELETE`
- URL: `/api/products/:id/permanent`
- Description: Delete a product only when it has no orders.
- Token: Yes

## Orders

### List My Orders

- Method: `GET`
- URL: `/api/orders`
- Description: Get orders where current user is buyer or seller.
- Token: Yes

### Create Order

- Method: `POST`
- URL: `/api/orders`
- Description: Buyer creates an order for an available product.
- Token: Yes

Request body:

```json
{
  "productId": 1,
  "cryptoAmount": "0.0100"
}
```

Response:

```json
{
  "message": "订单创建成功，请在链上锁定资金",
  "orderId": 1,
  "status": "PENDING",
  "cryptoAmount": "0.0100"
}
```

Common errors:

```json
{ "error": "该商品已被锁定或已售出" }
{ "error": "防刷提示：你不能购买自己发布的商品" }
```

### Mock Pay Order

- Method: `PATCH`
- URL: `/api/orders/:orderId/mock-pay`
- Description: In Web2 demo mode, move order from `PENDING` to `LOCKED`.
- Token: Yes

### Update Order Status

- Method: `PATCH`
- URL: `/api/orders/:orderId/status`
- Description: Seller ships, buyer completes, or buyer disputes an order.
- Token: Yes

Request body:

```json
{ "status": "SHIPPED" }
```

## Reviews

### Create Review

- Method: `POST`
- URL: `/api/reviews`
- Description: Buyer reviews seller after a `COMPLETED` order.
- Token: Yes

Request body:

```json
{
  "orderId": 1,
  "revieweeId": 2,
  "rating": 5,
  "content": "卖家很准时，商品状态很好。"
}
```

Common errors:

```json
{ "error": "只有已完成的订单才能评价" }
{ "error": "只有该订单的买家才能评价卖家" }
{ "error": "该订单已经评价过，不能重复评价" }
```

### User Reviews

- Method: `GET`
- URL: `/api/reviews/user/:id`
- Description: Public user profile reviews. Hidden reviews are not returned.
- Token: No

### User Review Summary

- Method: `GET`
- URL: `/api/reviews/summary/:id`
- Description: Get user credit summary.
- Token: No

## Reports

### Create Product Report

- Method: `POST`
- URL: `/api/reports`
- Description: Report a product.
- Token: Yes

Request body:

```json
{
  "productId": 1,
  "reason": "商品描述与实际不符"
}
```

## Admin

All admin APIs require a valid JWT and `ADMIN` role.

### Stats

- Method: `GET`
- URL: `/api/admin/stats`
- Description: Dashboard counts.
- Token: Yes, admin

### Users

- Method: `GET`
- URL: `/api/admin/users`
- Description: List users.
- Token: Yes, admin

Actions:

- `PATCH /api/admin/users/:id/ban`
- `PATCH /api/admin/users/:id/unban`
- `PATCH /api/admin/users/:id/reset-password`

### Products

- Method: `GET`
- URL: `/api/admin/products`
- Description: List all products.
- Token: Yes, admin

Actions:

- `PATCH /api/admin/products/:id/takedown`
- `DELETE /api/admin/products/:id`

### Orders

- Method: `GET`
- URL: `/api/admin/orders`
- Description: List all orders.
- Token: Yes, admin

Arbitrate:

- Method: `POST`
- URL: `/api/admin/orders/:orderId/arbitrate`
- Body: `{ "decision": "RELEASE" }` or `{ "decision": "REFUND" }`

### Reviews

- Method: `GET`
- URL: `/api/admin/reviews`
- Description: List all reviews, including hidden reviews.
- Token: Yes, admin

Actions:

- `PATCH /api/admin/reviews/:reviewId/hide`
- `DELETE /api/admin/reviews/:reviewId`

### Reports

- Method: `GET`
- URL: `/api/admin/reports`
- Description: List reports.
- Token: Yes, admin

Resolve:

- Method: `PATCH`
- URL: `/api/admin/reports/:id/resolve`

## Open Skill

### Credit Evaluate

- Method: `POST`
- URL: `/api/skills/credit-evaluate`
- Description: Evaluate a user's credit based on `User.creditRating` and visible received reviews.
- Token: No

Use cases:

- Third-party systems can quickly check seller credit before creating a trade.
- Course demo pages can show how platform data can be exposed as a reusable Skill.
- Admin or operation tools can use the result as a lightweight risk reference.

Request body:

```json
{
  "userId": 2
}
```

Response:

```json
{
  "userId": 2,
  "nickname": "seller",
  "email": "seller@test.com",
  "creditRating": 96,
  "averageRating": 4.8,
  "reviewCount": 6,
  "negativeReviewCount": 0,
  "creditLevel": "优秀",
  "riskLevel": "低风险",
  "advice": "该用户信誉较好，建议继续保持及时沟通和按时发货。"
}
```

Rules:

- `averageRating`: average rating of visible reviews received by the user.
- `reviewCount`: count of visible reviews received by the user.
- `negativeReviewCount`: count of visible reviews where `rating <= 2`.
- `creditLevel`: `优秀` for `creditRating >= 100`, `良好` for `>= 90`, `一般` for `>= 75`, otherwise `较低`.
- `riskLevel`: `高风险` when `negativeReviewCount >= 3` or `creditRating < 75`; `中风险` when `negativeReviewCount >= 1` or `creditRating < 90`; otherwise `低风险`.

Common errors:

```json
{
  "error": "userId 缺失或格式不正确",
  "example": {
    "userId": 2
  }
}
```

```json
{
  "error": "用户不存在",
  "userId": 999
}
```

```json
{
  "error": "信誉评估失败",
  "details": "..."
}
```
