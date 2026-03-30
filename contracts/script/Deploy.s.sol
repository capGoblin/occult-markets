// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { OccultMarket } from "../src/OccultMarket.sol";

contract Deploy is Script {
    function run() external returns (OccultMarket market) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        market = new OccultMarket();
        console.log("OccultMarket deployed to:", address(market));

        uint256 marketId = market.createMarket(
            "Will ETH hit $4000 before June 1 2026?",
            427 days // roughly until June 1 2026 from now
        );
        console.log("Market created, id:", marketId);
        console.log("Initial price: 500 (50/50)");

        vm.stopBroadcast();

        console.log("\n--- Update frontend/src/lib/config.ts ---");
        console.log("CONTRACT_ADDRESS =", address(market));
    }
}
