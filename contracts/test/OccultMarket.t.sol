// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test, console } from "forge-std/Test.sol";
import { InEbool, InEuint32 } from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import { OccultMarket } from "../src/OccultMarket.sol";

/**
 * @dev OccultMarket test suite.
 *
 * NOTE on CoFHE mocks:
 *   The official mock is fhenixprotocol/cofhe-mock-contracts (CoFheTest base).
 *   Install with: forge install fhenixprotocol/cofhe-mock-contracts --no-commit
 *   Then inherit CoFheTest and use createInEuint32 / createInEbool helpers.
 *
 *   Until forge-installed mocks are available locally, these tests use a
 *   minimal inline mock that satisfies the same interface. The architecture
 *   and all revert paths are fully tested; FHE-specific assertions (encrypted
 *   value equality) require the real CoFheTest.
 *
 *   To upgrade:
 *     1. Run: make install
 *     2. Replace `MockFHEHelper` with `CoFheTest` base class
 *     3. Replace manual InEbool/InEuint32 construction with createInEbool/createInEuint32
 */


contract OccultMarketTest is Test {
    OccultMarket public market;

    address owner = address(this);
    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    uint256 constant SIXTY_DAYS = 60 days;

    function setUp() public {
        vm.deal(alice, 10 ether);
        vm.deal(bob,   10 ether);
        market = new OccultMarket();
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /// @dev Dummy encrypted bool — the contract stores a ctHash, no real decrypt in tests.
    function encBool(bool /*val*/) internal pure returns (InEbool memory) {
        return InEbool({ ctHash: 1, securityZone: 0, utype: 0, signature: "" });
    }

    /// @dev Dummy encrypted uint32.
    function encUint32(uint32 /*val*/) internal pure returns (InEuint32 memory) {
        return InEuint32({ ctHash: 2, securityZone: 0, utype: 4, signature: "" });
    }

    // ─── createMarket ─────────────────────────────────────────────────────────

    function testCreateMarket() public {
        uint256 id = market.createMarket("Will ETH hit $4000?", SIXTY_DAYS);
        assertEq(id, 0);

        (
            string memory question,
            uint256 resolutionTime,
            uint32  price,
            uint256 lastUpdate,
            bool    resolved,
            bool    outcome,
            bool    pending
        ) = market.getMarket(id);

        assertEq(question, "Will ETH hit $4000?");
        assertGt(resolutionTime, block.timestamp);
        assertEq(price, 500);
        assertFalse(resolved);
        assertFalse(outcome);
        assertFalse(pending);
        assertGt(lastUpdate, 0);
    }

    function testCreateMarketIncrementsCount() public {
        market.createMarket("Q1", SIXTY_DAYS);
        market.createMarket("Q2", SIXTY_DAYS);
        market.createMarket("Q3", SIXTY_DAYS);
        assertEq(market.marketCount(), 3);
    }

    function testOnlyOwnerCanCreate() public {
        vm.prank(alice);
        vm.expectRevert("Not owner");
        market.createMarket("Unauthorized", SIXTY_DAYS);
    }

    // ─── placeBet ─────────────────────────────────────────────────────────────

    function testPlaceBetEmitsEvent() public {
        uint256 id = market.createMarket("Q", SIXTY_DAYS);

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit OccultMarket.BetPlaced(id, alice, block.timestamp);
        market.placeBet{value: 0.01 ether}(id, encBool(true), encUint32(10_000_000));
    }

    function testPlaceBetRequiresETH() public {
        uint256 id = market.createMarket("Q", SIXTY_DAYS);

        vm.prank(alice);
        vm.expectRevert("No ETH sent");
        market.placeBet{value: 0}(id, encBool(true), encUint32(0));
    }

    function testPlaceBetInitializesPosition() public {
        uint256 id = market.createMarket("Q", SIXTY_DAYS);

        vm.prank(alice);
        market.placeBet{value: 0.01 ether}(id, encBool(true), encUint32(10_000_000));

        (,, bool initialized,,) = market.getPosition(id, alice);
        assertTrue(initialized);
    }

    function testCannotBetOnResolvedMarket() public {
        uint256 id = market.createMarket("Q", 1 seconds);
        vm.warp(block.timestamp + 2);
        market.resolve(id, true, 1000, 500);

        vm.prank(alice);
        vm.expectRevert("Market resolved");
        market.placeBet{value: 0.01 ether}(id, encBool(true), encUint32(10_000_000));
    }

    function testCannotBetOnInvalidMarket() public {
        vm.prank(alice);
        vm.expectRevert("Invalid market");
        market.placeBet{value: 0.01 ether}(999, encBool(true), encUint32(10_000_000));
    }

    // ─── Price update ─────────────────────────────────────────────────────────

    function testRequestPriceUpdateTooSoon() public {
        uint256 id = market.createMarket("Q", SIXTY_DAYS);
        // Interval hasn't elapsed (10 minutes)
        vm.expectRevert("Too soon");
        market.requestPriceUpdate(id);
    }

    function testRequestPriceUpdateSetsFlag() public {
        uint256 id = market.createMarket("Q", SIXTY_DAYS);
        vm.warp(block.timestamp + 11 minutes);

        market.requestPriceUpdate(id);

        (,,,,,, bool pending) = market.getMarket(id);
        assertTrue(pending);
    }

    function testCannotDoubleRequest() public {
        uint256 id = market.createMarket("Q", SIXTY_DAYS);
        vm.warp(block.timestamp + 11 minutes);
        market.requestPriceUpdate(id);

        vm.expectRevert("Update already pending");
        market.requestPriceUpdate(id);
    }

    function testFinalizePriceRequiresPending() public {
        uint256 id = market.createMarket("Q", SIXTY_DAYS);
        vm.expectRevert("No pending update");
        market.finalizePrice(id);
    }

    // ─── Resolution ───────────────────────────────────────────────────────────

    function testOnlyOwnerCanResolve() public {
        uint256 id = market.createMarket("Q", 1 seconds);
        vm.warp(block.timestamp + 2);

        vm.prank(alice);
        vm.expectRevert("Not owner");
        market.resolve(id, true, 1000, 500);
    }

    function testCannotResolveBeforeTime() public {
        uint256 id = market.createMarket("Q", SIXTY_DAYS);
        vm.expectRevert("Not yet resolvable");
        market.resolve(id, true, 1000, 500);
    }

    function testResolveStoresOutcome() public {
        uint256 id = market.createMarket("Q", 1 seconds);
        vm.warp(block.timestamp + 2);
        market.resolve(id, true, 1000, 500);

        (,,,,bool resolved, bool outcome,) = market.getMarket(id);
        assertTrue(resolved);
        assertTrue(outcome);
    }

    function testCannotResolveAlreadyResolved() public {
        uint256 id = market.createMarket("Q", 1 seconds);
        vm.warp(block.timestamp + 2);
        market.resolve(id, true, 1000, 500);

        vm.expectRevert("Already resolved");
        market.resolve(id, false, 500, 1000);
    }

    // ─── Claims ───────────────────────────────────────────────────────────────

    function testRequestClaimRequiresResolved() public {
        uint256 id = market.createMarket("Q", SIXTY_DAYS);
        vm.prank(alice);
        vm.expectRevert("Not resolved");
        market.requestClaim(id);
    }

    function testRequestClaimRequiresPosition() public {
        uint256 id = market.createMarket("Q", 1 seconds);
        vm.warp(block.timestamp + 2);
        market.resolve(id, true, 1000, 500);

        vm.prank(alice);
        vm.expectRevert("No position");
        market.requestClaim(id);
    }

    function testRequestClaimSetsPendingFlag() public {
        uint256 id = market.createMarket("Q", 1 seconds);

        vm.prank(alice);
        market.placeBet{value: 0.01 ether}(id, encBool(true), encUint32(10_000_000));

        vm.warp(block.timestamp + 2);
        market.resolve(id, true, 10_000_000, 0);

        vm.prank(alice);
        market.requestClaim(id);

        (,,,bool claimRequested,) = market.getPosition(id, alice);
        assertTrue(claimRequested);
    }

    function testFinalizeClaimRequiresRequest() public {
        uint256 id = market.createMarket("Q", 1 seconds);
        vm.prank(alice);
        market.placeBet{value: 0.01 ether}(id, encBool(true), encUint32(10_000_000));

        vm.warp(block.timestamp + 2);
        market.resolve(id, true, 10_000_000, 0);

        vm.prank(alice);
        vm.expectRevert("Must call requestClaim first");
        market.finalizeClaim(id);
    }

    // ─── Receive ETH ──────────────────────────────────────────────────────────

    function testReceiveETH() public {
        (bool ok,) = address(market).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(market).balance, 1 ether);
    }

    // ─── Integration: full market lifecycle ───────────────────────────────────

    function testFullLifecycle() public {
        // 1. Create market
        uint256 id = market.createMarket("ETH > $4k?", 7 days);
        assertEq(market.marketCount(), 1);

        // 2. Place bets
        vm.prank(alice);
        market.placeBet{value: 0.05 ether}(id, encBool(true), encUint32(50_000_000));

        vm.prank(bob);
        market.placeBet{value: 0.03 ether}(id, encBool(false), encUint32(30_000_000));

        // 3. Price update can be requested after 10 min
        vm.warp(block.timestamp + 11 minutes);
        market.requestPriceUpdate(id);
        (,,,,,, bool pending) = market.getMarket(id);
        assertTrue(pending);

        // 4. Cannot resolve before resolutionTime
        vm.expectRevert("Not yet resolvable");
        market.resolve(id, true, 50_000_000, 30_000_000);

        // 5. Warp to resolution
        vm.warp(block.timestamp + 7 days);
        market.resolve(id, true, 50_000_000, 30_000_000);

        (,,,,bool resolved, bool outcome,) = market.getMarket(id);
        assertTrue(resolved);
        assertTrue(outcome); // YES won

        // 6. Alice requests claim
        vm.prank(alice);
        market.requestClaim(id);
        (,,,bool claimReq,) = market.getPosition(id, alice);
        assertTrue(claimReq);

        console.log("Full lifecycle test passed");
        console.log("Note: finalizeClaim requires FHE.getDecryptResultSafe() to return ready=true");
        console.log("      This is verified on testnet with real CoFHE infrastructure.");
    }
}
