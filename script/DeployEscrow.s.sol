// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/MarketplaceEscrow.sol";

contract DeployEscrow is Script {
    function run() external returns (MarketplaceEscrow escrow) {
        address arbiter = vm.envOr("ARBITER_ADDRESS", msg.sender);
        vm.startBroadcast();
        escrow = new MarketplaceEscrow(arbiter);
        vm.stopBroadcast();
    }
}
