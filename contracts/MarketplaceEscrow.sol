// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != ENTERED, "ReentrancyGuard: reentrant call");
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }
}

contract MarketplaceEscrow is ReentrancyGuard {
    
    enum OrderStatus { NonExistent, Locked, Shipped, Completed, Disputed, Refunded }

    struct Order {
        address buyer;
        address seller;
        uint256 amount;
        OrderStatus status;
        uint256 lockedAt;   // 记录买家锁定资金的时间
        uint256 shippedAt;  // 记录卖家发货的时间
    }

    // 双向超时时限定义（大作业演示时可以把 days 改为 minutes）
    uint256 public constant SHIPPING_TIMEOUT = 3 days;  // 卖家必须在 3 天内发货，否则买家可撤单
    uint256 public constant CONFIRM_TIMEOUT = 7 days;   // 卖家发货后买家有 7 天时间确认或拒绝

    address public arbiter;
    mapping(uint256 => Order) public orders;

    event FundsLocked(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount);
    event OrderShipped(uint256 indexed orderId);
    event FundsReleased(uint256 indexed orderId);
    event OrderCancelledByBuyer(uint256 indexed orderId);
    event DisputeRaised(uint256 indexed orderId, address raisedBy);
    event DisputeResolved(uint256 indexed orderId, uint256 buyerShare, uint256 sellerShare);

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Only arbiter can call this");
        _;
    }

    constructor() {
        arbiter = msg.sender;
    }

    /**
     * @notice 1. 买家下单并锁定资金（修复报错版）
     */
    function lockFunds(uint256 orderId, address seller) external payable nonReentrant {
        require(orders[orderId].status == OrderStatus.NonExistent, "Order already exists");
        require(msg.value > 0, "Must send crypto to lock");
        require(seller != address(0) && seller != msg.sender, "Invalid seller address");

        // 明确为结构体中的所有字段赋值，彻底修复编译报错
        orders[orderId] = Order({
            buyer: msg.sender,
            seller: seller,
            amount: msg.value,
            status: OrderStatus.Locked,
            lockedAt: block.timestamp, // 记录锁仓起点
            shippedAt: 0               // 尚未发货，初始化为 0
        });

        emit FundsLocked(orderId, msg.sender, seller, msg.value);
    }

    /**
     * @notice 2. 卖家声明发货
     */
    function shipOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Locked, "Invalid order status");
        require(msg.sender == order.seller, "Only seller can ship");

        order.status = OrderStatus.Shipped;
        order.shippedAt = block.timestamp; // 记录发货起点
        
        emit OrderShipped(orderId);
    }

    /**
     * @notice 新增功能：卖家迟迟不发货，买家超时强制取消订单退款
     */
    function refundShippingTimeout(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Locked, "Order status must be Locked");
        require(msg.sender == order.buyer, "Only buyer can cancel un-shipped order");
        require(block.timestamp >= order.lockedAt + SHIPPING_TIMEOUT, "Shipping timeout has not passed yet");

        uint256 refundAmount = order.amount;
        address targetBuyer = order.buyer;

        // CEI 模式修改状态
        order.status = OrderStatus.Refunded;
        order.amount = 0;

        (bool success, ) = targetBuyer.call{value: refundAmount}("");
        require(success, "Refund to buyer failed");

        emit OrderCancelledByBuyer(orderId);
    }

    /**
     * @notice 3. 买家确认收货（放款给卖家）
     */
    function confirmReceipt(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Shipped || order.status == OrderStatus.Disputed, "Invalid status");
        require(msg.sender == order.buyer, "Only buyer can confirm receipt");

        uint256 payoutAmount = order.amount;
        address targetSeller = order.seller;

        order.status = OrderStatus.Completed;
        order.amount = 0; 

        (bool success, ) = targetSeller.call{value: payoutAmount}("");
        require(success, "Transfer to seller failed");

        emit FundsReleased(orderId);
    }

    /**
     * @notice 4. 买家长期不确认，卖家超时强制提款
     */
    function claimTimeoutFunds(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Shipped, "Order not shipped or already closed");
        require(msg.sender == order.seller, "Only seller can claim timeout funds");
        require(block.timestamp >= order.shippedAt + CONFIRM_TIMEOUT, "Confirm timeout has not passed yet");

        uint256 payoutAmount = order.amount;
        address targetSeller = order.seller;

        order.status = OrderStatus.Completed;
        order.amount = 0;

        (bool success, ) = targetSeller.call{value: payoutAmount}("");
        require(success, "Timeout transfer failed");

        emit FundsReleased(orderId);
    }

    /**
     * @notice 5. 仲裁官介入裁决（支持按比例划分退款，防止两败俱伤）
     * @param buyerShare 给买家退多少钱（单位：wei）
     * @param sellerShare 给卖家放多少钱（单位：wei）
     */
    function resolveDispute(
        uint256 orderId,
        uint256 buyerShare,
        uint256 sellerShare
    ) external onlyArbiter nonReentrant {
        Order storage order = orders[orderId];
        require(
            order.status == OrderStatus.Disputed,
            "Order is not in dispute"
        );
        require(
            buyerShare + sellerShare == order.amount,
            "Sum must match total locked amount"
        );

        address targetBuyer = order.buyer;
        address targetSeller = order.seller;

        // 修改状态并清空金额
        order.status = (buyerShare == order.amount)
            ? OrderStatus.Refunded
            : OrderStatus.Completed;
        order.amount = 0;

        // 分别放款
        if (buyerShare > 0) {
            (bool successBuyer, ) = targetBuyer.call{value: buyerShare}("");
            require(successBuyer, "Refund to buyer failed");
        }
        if (sellerShare > 0) {
            (bool successSeller, ) = targetSeller.call{value: sellerShare}("");
            require(successSeller, "Payout to seller failed");
        }

        emit DisputeResolved(orderId, buyerShare, sellerShare);
    }
}
