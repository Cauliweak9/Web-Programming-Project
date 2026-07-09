$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$image = "ghcr.io/foundry-rs/foundry:latest"
$containerName = "campus-anvil-osaka"
$anvilPort = if ($env:ANVIL_PORT) { $env:ANVIL_PORT } else { "8546" }
$deployerKey = if ($env:PRIVATE_KEY) { $env:PRIVATE_KEY } else { "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" }
$adminWallet = if ($env:ARBITER_ADDRESS) { $env:ARBITER_ADDRESS } else { "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" }

Set-Location $projectRoot

Write-Host "[1/7] Stop old local app on port 3000 if it exists"
$port3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($port3000) {
    Stop-Process -Id $port3000.OwningProcess -Force -ErrorAction SilentlyContinue
}

Write-Host "[2/7] Reset Prisma schema and demo data"
npx prisma db push --accept-data-loss
npm run seed

Write-Host "[3/7] Start Anvil Osaka chain on port $anvilPort"
$existing = docker ps -a -q -f name=$containerName
if ($existing) {
    docker rm -f $containerName | Out-Null
}
docker run -d --name $containerName -p "${anvilPort}:8545" $image "anvil --host 0.0.0.0 --hardfork osaka" | Out-Null
Start-Sleep -Seconds 2

Write-Host "[4/7] Verify Anvil RPC"
$chain = Invoke-RestMethod -Uri "http://127.0.0.1:$anvilPort" -Method POST -ContentType "application/json" -Body '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
if ($chain.result -ne "0x7a69") { throw "Unexpected chain id: $($chain.result)" }

Write-Host "[5/7] Deploy MarketplaceEscrow and write config.ini"
$env:ANVIL_PORT = "$anvilPort"
$env:PRIVATE_KEY = $deployerKey
$env:ARBITER_ADDRESS = $adminWallet
.\scripts\deploy-web3.ps1

Write-Host "[6/7] Re-seed clean demo accounts with deterministic wallet addresses"
$env:DEMO_ADMIN_WALLET = $adminWallet
$env:DEMO_BUYER_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
$env:DEMO_SELLER_WALLET = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
npm run seed

Write-Host "[7/7] Start npm run dev on http://localhost:3000"
Start-Process -FilePath npm -ArgumentList "run", "dev" -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null
Start-Sleep -Seconds 4
$web3 = Invoke-RestMethod "http://localhost:3000/api/web3/config"

Write-Host ""
Write-Host "Initialization complete."
Write-Host "App: http://localhost:3000/index.html"
Write-Host "RPC: http://127.0.0.1:$anvilPort"
Write-Host "Contract: $($web3.contractAddress)"
Write-Host "Arbiter/Admin wallet: $adminWallet"
Write-Host ""
Write-Host "Demo accounts:"
Write-Host "  admin@test.com  / 123456"
Write-Host "  seller@test.com / 123456"
Write-Host "  buyer@test.com  / 123456"
