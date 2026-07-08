ALTER TABLE "User" ADD COLUMN "walletAddress" TEXT,
ADD COLUMN "walletBoundAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

ALTER TABLE "Order" ADD COLUMN "chainId" INTEGER,
ADD COLUMN "contractAddress" TEXT,
ADD COLUMN "buyerAddress" TEXT,
ADD COLUMN "sellerAddress" TEXT,
ADD COLUMN "lockTxHash" TEXT,
ADD COLUMN "shipTxHash" TEXT,
ADD COLUMN "completeTxHash" TEXT,
ADD COLUMN "disputeTxHash" TEXT,
ADD COLUMN "arbitrationTxHash" TEXT;
