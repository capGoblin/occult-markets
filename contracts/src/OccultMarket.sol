// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

/**
 * @title OccultMarket — Wave 1 (v2: euint64)
 */
contract OccultMarket {

    // ─── Types ───────────────────────────────────────────────────────────────

    struct Market {
        string  question;
        uint256 resolutionTime;
        uint32  currentPrice;       // 0–1000 scaled (500 = 50%)
        uint256 lastPriceUpdate;
        euint64 yes_pool;           // ENCRYPTED total YES capital (gwei units)
        euint64 no_pool;            // ENCRYPTED total NO capital (gwei units)
        bool    resolved;
        bool    outcome;            // true = YES won
        uint256 finalYesTotal;      // gwei units (plaintext)
        uint256 finalNoTotal;       // gwei units (plaintext)
        bool    priceUpdatePending;
        euint64 yesSnap;            // snapshot handle
        euint64 noSnap;
    }

    struct Position {
        euint64 yes;                // ENCRYPTED YES position (gwei units)
        euint64 no;                 // ENCRYPTED NO position (gwei units)
        bool    initialized;
        bool    claimRequested;
        bool    claimed;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    mapping(uint256 => Market)                            public  markets;
    mapping(uint256 => mapping(address => Position))     private positions;

    uint256 public marketCount;
    address public owner;

    euint64 private ZERO64;

    uint256 public constant PRICE_UPDATE_INTERVAL = 10 minutes;
    uint256 private constant GWEI = 1e9;

    // ─── Events ──────────────────────────────────────────────────────────────

    event MarketCreated(uint256 indexed marketId, string question, uint256 resolutionTime);
    event BetPlaced(uint256 indexed marketId, address indexed user, uint256 timestamp);
    event PriceUpdateRequested(uint256 indexed marketId, uint256 timestamp);
    event PriceUpdated(uint256 indexed marketId, uint32 newPrice, uint256 timestamp);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event ClaimRequested(uint256 indexed marketId, address indexed user);
    event Claimed(uint256 indexed marketId, address indexed user, uint256 amount);

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        ZERO64 = FHE.asEuint64(0);
        FHE.allowThis(ZERO64);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function createMarket(string calldata question, uint256 duration) external onlyOwner returns (uint256 marketId) {
        marketId = marketCount++;
        Market storage m = markets[marketId];
        m.question = question;
        m.resolutionTime = block.timestamp + duration;
        m.currentPrice   = 500;
        m.lastPriceUpdate = block.timestamp;
        
        // Initial liquidity: 1,000,000 Gwei (0.001 ETH) each side
        m.yes_pool = FHE.asEuint64(1000000);
        m.no_pool  = FHE.asEuint64(1000000);
        
        FHE.allowThis(m.yes_pool);
        FHE.allowThis(m.no_pool);

        emit MarketCreated(marketId, question, m.resolutionTime);
    }

    // ─── Betting ─────────────────────────────────────────────────────────────

    function placeBet(
        uint256     marketId,
        InEbool  memory encryptedDirection,
        InEuint64 memory encryptedAmount
    ) external payable {
        Market storage m = markets[marketId];
        require(marketId < marketCount,  "Invalid market");
        require(!m.resolved,             "Market resolved");
        require(msg.value > 0,           "No ETH sent");

        ebool  dir = FHE.asEbool(encryptedDirection);
        euint64 amt = FHE.asEuint64(encryptedAmount);
        FHE.allowThis(dir);
        FHE.allowThis(amt);

        euint64 yesAdd = FHE.select(dir, amt, ZERO64);
        euint64 noAdd  = FHE.select(dir, ZERO64, amt);
        FHE.allowThis(yesAdd);
        FHE.allowThis(noAdd);

        m.yes_pool = FHE.add(m.yes_pool, yesAdd);
        m.no_pool  = FHE.add(m.no_pool,  noAdd);
        FHE.allowThis(m.yes_pool);
        FHE.allowThis(m.no_pool);

        Position storage pos = positions[marketId][msg.sender];
        if (!pos.initialized) {
            pos.yes = FHE.asEuint64(0);
            pos.no  = FHE.asEuint64(0);
            FHE.allowThis(pos.yes);
            FHE.allowThis(pos.no);
            pos.initialized = true;
        }

        pos.yes = FHE.add(pos.yes, yesAdd);
        pos.no  = FHE.add(pos.no,  noAdd);
        FHE.allowThis(pos.yes);
        FHE.allowThis(pos.no);
        FHE.allowSender(pos.yes);
        FHE.allowSender(pos.no);

        emit BetPlaced(marketId, msg.sender, block.timestamp);
    }

    // ─── Price update ────────────────────────────────────────────────────────

    function requestPriceUpdate(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(marketId < marketCount, "Invalid market");
        require(!m.resolved, "Market resolved");
        require(!m.priceUpdatePending, "Pending");
        require(block.timestamp >= m.lastPriceUpdate + PRICE_UPDATE_INTERVAL, "Too soon");

        m.yesSnap = m.yes_pool;
        m.noSnap  = m.no_pool;
        m.priceUpdatePending = true;

        FHE.allowPublic(m.yesSnap);
        FHE.allowPublic(m.noSnap);

        emit PriceUpdateRequested(marketId, block.timestamp);
    }

    function publishPriceUpdate(
        uint256 marketId,
        uint64 yesVal,
        bytes calldata yesSig,
        uint64 noVal,
        bytes calldata noSig
    ) external {
        Market storage m = markets[marketId];
        FHE.publishDecryptResult(m.yesSnap, yesVal, yesSig);
        FHE.publishDecryptResult(m.noSnap, noVal, noSig);
    }

    function finalizePrice(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.priceUpdatePending, "No pending");

        (uint64 yesTotal, bool yesReady) = FHE.getDecryptResultSafe(m.yesSnap);
        (uint64 noTotal,  bool noReady)  = FHE.getDecryptResultSafe(m.noSnap);
        require(yesReady && noReady, "Not ready");

        uint256 total = uint256(yesTotal) + uint256(noTotal);
        if (total > 0) {
            m.currentPrice = uint32((uint256(yesTotal) * 1000) / total);
        }
        m.lastPriceUpdate    = block.timestamp;
        m.priceUpdatePending = false;

        emit PriceUpdated(marketId, m.currentPrice, block.timestamp);
    }

    // ─── Resolution ──────────────────────────────────────────────────────────

    function resolve(
        uint256 marketId,
        bool    outcome,
        uint256 finalYesTotal,
        uint256 finalNoTotal
    ) external onlyOwner {
        Market storage m = markets[marketId];
        require(marketId < marketCount, "Invalid market");
        require(!m.resolved,            "Already resolved");
        require(block.timestamp >= m.resolutionTime, "Not yet resolvable");

        m.resolved      = true;
        m.outcome       = outcome;
        m.finalYesTotal = finalYesTotal;
        m.finalNoTotal  = finalNoTotal;

        emit MarketResolved(marketId, outcome);
    }

    // ─── Payout ──────────────────────────────────────────────────────────────

    function requestClaim(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.resolved, "Not resolved");

        Position storage pos = positions[marketId][msg.sender];
        require(pos.initialized,      "No position");
        require(!pos.claimed,         "Already claimed");
        require(!pos.claimRequested,  "In progress");

        pos.claimRequested = true;

        if (m.outcome) {
            FHE.allowPublic(pos.yes);
        } else {
            FHE.allowPublic(pos.no);
        }

        emit ClaimRequested(marketId, msg.sender);
    }

    function publishClaim(
        uint256 marketId,
        address user,
        uint64  amount,
        bytes calldata signature
    ) external {
        Market storage m = markets[marketId];
        Position storage pos = positions[marketId][user];
        if (m.outcome) {
            FHE.publishDecryptResult(pos.yes, amount, signature);
        } else {
            FHE.publishDecryptResult(pos.no, amount, signature);
        }
    }

    function finalizeClaim(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.resolved, "Not resolved");

        Position storage pos = positions[marketId][msg.sender];
        require(pos.claimRequested, "Request first");
        require(!pos.claimed,       "Claimed");

        (uint64 userPosition, bool ready) = FHE.getDecryptResultSafe(m.outcome ? pos.yes : pos.no);
        require(ready, "Not ready");
        require(userPosition > 0, "No winning pos");

        uint256 winningTotal = m.outcome ? m.finalYesTotal : m.finalNoTotal;
        uint256 totalPool    = m.finalYesTotal + m.finalNoTotal;

        uint256 payout = (uint256(userPosition) * totalPool * GWEI) / winningTotal;

        pos.claimed        = true;
        pos.claimRequested = false;

        (bool ok,) = payable(msg.sender).call{value: payout}("");
        require(ok, "Failed");

        emit Claimed(marketId, msg.sender, payout);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getMarket(uint256 marketId) external view returns (
        string memory question,
        uint256 resolutionTime,
        uint32  currentPrice,
        uint256 lastPriceUpdate,
        bool    resolved,
        bool    outcome,
        bool    priceUpdatePending,
        euint64 yesSnap,
        euint64 noSnap
    ) {
        Market storage m = markets[marketId];
        return (
            m.question,
            m.resolutionTime,
            m.currentPrice,
            m.lastPriceUpdate,
            m.resolved,
            m.outcome,
            m.priceUpdatePending,
            m.yesSnap,
            m.noSnap
        );
    }

    function getPosition(uint256 marketId, address user) external view returns (
        euint64 yes,
        euint64 no,
        bool    initialized,
        bool    claimRequested,
        bool    claimed
    ) {
        Position storage pos = positions[marketId][user];
        return (pos.yes, pos.no, pos.initialized, pos.claimRequested, pos.claimed);
    }

    receive() external payable {}
}
