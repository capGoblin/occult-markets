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

        uint256 m1 = market.createMarket(
            "Will ETH hit $4000 before Q3 2026?",
            400 days
        );
        console.log("Market created (ETH), id:", m1);

        uint256 m2 = market.createMarket(
            "OpenAI drops GPT-6 before December 2026?",
            250 days
        );
        console.log("Market created (GPT-6), id:", m2);

        uint256 m3 = market.createMarket(
            "Will Bitcoin nuke past $100K before Q3 2026 ends?",
            180 days
        );
        console.log("Market created (BTC), id:", m3);

        uint256 m4 = market.createMarket(
            "AGI achieved before 2030?",
            1200 days
        );
        console.log("Market created (AGI), id:", m4);

        console.log("Initial prices: 500 (50/50)");

        vm.stopBroadcast();

        console.log("\n--- Update frontend/src/lib/config.ts ---");
        console.log("CONTRACT_ADDRESS =", address(market));
    }
}
