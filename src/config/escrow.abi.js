export const ESCROW_ABI = [
    'event FundsLocked(uint256 indexed orderId,address indexed buyer,address indexed seller,uint256 amount)',
    'event OrderShipped(uint256 indexed orderId)',
    'event FundsReleased(uint256 indexed orderId)',
    'event OrderCancelledByBuyer(uint256 indexed orderId)',
    'event DisputeRaised(uint256 indexed orderId,address raisedBy)',
    'event DisputeResolved(uint256 indexed orderId,uint256 buyerShare,uint256 sellerShare)',
    'event ArbiterChanged(address indexed oldArbiter,address indexed newArbiter)',
    'function lockFunds(uint256 orderId,address seller) payable',
    'function shipOrder(uint256 orderId)',
    'function confirmReceipt(uint256 orderId)',
    'function raiseDispute(uint256 orderId)',
    'function resolveDispute(uint256 orderId,uint256 buyerShare,uint256 sellerShare)',
    'function transferArbiter(address newArbiter)',
    'function arbiter() view returns (address)'
];
