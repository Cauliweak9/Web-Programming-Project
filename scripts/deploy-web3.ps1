$ErrorActionPreference = "Stop"

$image = "ghcr.io/foundry-rs/foundry:latest"
$rpcUrl = $env:RPC_URL
$privateKey = $env:PRIVATE_KEY
$arbiterAddress = $env:ARBITER_ADDRESS
$projectPath = (Get-Location).Path
$anvilPort = $env:ANVIL_PORT

if (-not $anvilPort) {
    $anvilPort = "8546"
}

if (-not $rpcUrl) {
    $rpcUrl = "http://host.docker.internal:$anvilPort"
}
if (-not $privateKey) {
    throw "PRIVATE_KEY is required. Use an Anvil default private key for local demo."
}
if (-not $arbiterAddress) {
    $arbiterAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
}

docker run --rm -e "ARBITER_ADDRESS=$arbiterAddress" -v "${projectPath}:/app" -w /app $image "forge build"
$output = docker run --rm -e "ARBITER_ADDRESS=$arbiterAddress" -v "${projectPath}:/app" -w /app $image "forge script script/DeployEscrow.s.sol:DeployEscrow --rpc-url $rpcUrl --private-key $privateKey --broadcast"
$output

$match = [regex]::Match($output, "(?mi)(?:Deployed to|Contract Address):\s*(0x[a-fA-F0-9]{40})|contract\s+MarketplaceEscrow\s+(0x[a-fA-F0-9]{40})")
if (-not $match.Success) {
    throw "Deployment finished but contract address was not parsed. Check forge output above."
}

$address = $match.Groups[1].Value
if (-not $address) {
    $address = $match.Groups[2].Value
}
$config = Get-Content config.ini -Raw
$config = [regex]::Replace($config, "(?m)^WEB3_MODE\s*=.*$", "WEB3_MODE = TRUE")
$config = [regex]::Replace($config, "(?m)^RPC_URL\s*=.*$", "RPC_URL = http://127.0.0.1:$anvilPort")
$config = [regex]::Replace($config, "(?m)^CONTRACT_ADDRESS\s*=.*$", "CONTRACT_ADDRESS = $address")
Set-Content config.ini $config -Encoding utf8

Write-Host "MarketplaceEscrow deployed: $address"
Write-Host "Arbiter: $arbiterAddress"
