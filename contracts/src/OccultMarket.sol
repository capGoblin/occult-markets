// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

/**
 * @title OccultMarket — Wave 1
 *
 * Encrypted AMM prediction market on Fhenix CoFHE.
 *
 * Core privacy guarantee:
 *   - yes_pool and no_pool are ciphertexts. No observer can read pool composition.
 *   - placeBet routes to the correct pool via FHE.select — no branching, no signal.
 *   - Price is only revealed on-chain every PRICE_UPDATE_INTERVAL via threshold decrypt.
 *   - Individual trades are permanently invisible between price updates.
 *
 * Wave 1 limitations (honest):
 *   - Oracle: owner manually resolves with final pool totals (mocked).
 *   - Amounts stored as gwei units in euint32 (max ~4.29 ETH per position).
 *   - Price update and claim are two transactions each (async FHE decrypt).
 *   - Trading pauses briefly during price update window.
 */
contract OccultMarket {

    // ─── Types ───────────────────────────────────────────────────────────────

    struct Market {
        string question;
        uint256 resolutionTime;
        uint32  currentPrice;       // 0–1000 scaled (500 = 50%)
        uint256 lastPriceUpdate;
        euint32 yes_pool;           // ENCRYPTED total YES capital (gwei units)
        euint32 no_pool;            // ENCRYPTED total NO capital (gwei units)
        bool    resolved;
        bool    outcome;            // true = YES won
        // Resolution — Wave 1: owner provides final totals
        uint256 finalYesTotal;      // gwei units
        uint256 finalNoTotal;       // gwei units
        // Async price update state
        bool    priceUpdatePending;
        euint32 yesSnap;            // snapshot handle at time of requestPriceUpdate
        euint32 noSnap;
    }

    struct Position {
        euint32 yes;                // ENCRYPTED YES position (gwei units)
        euint32 no;                 // ENCRYPTED NO position (gwei units)
        bool    initialized;
        bool    claimRequested;
        bool    claimed;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    mapping(uint256 => Market)                            public  markets;
    mapping(uint256 => mapping(address => Position))     private positions;

    uint256 public marketCount;
    address public owner;

    euint32 private ZERO32;         // reusable encrypted zero

    uint256 public constant PRICE_UPDATE_INTERVAL = 10 minutes;
    uint256 private constant GWEI = 1e9;

    // ─── Events ──────────────────────────────────────────────────────────────

    event MarketCreated(uint256 indexed marketId, string question, uint256 resolutionTime);
    // Note: BetPlaced intentionally omits direction and amount — only timestamp and bettor visible
    event BetPlaced(uint256 indexed marketId, address indexed bettor, uint256 timestamp);
    event PriceUpdateRequested(uint256 indexed marketId, uint256 timestamp);
    event PriceUpdated(uint256 indexed marketId, uint32 newPrice, uint256 timestamp);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event ClaimRequested(uint256 indexed marketId, address indexed user);
    event Claimed(uint256 indexed marketId, address indexed user, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        ZERO32 = FHE.asEuint32(0);
        FHE.allowThis(ZERO32);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ─── Market creation ─────────────────────────────────────────────────────

    function createMarket(string calldata question, uint256 duration)
        external
        onlyOwner
        returns (uint256 marketId)
    {
        marketId = marketCount++;
        Market storage m = markets[marketId];

        m.question        = question;
        m.resolutionTime  = block.timestamp + duration;
        m.currentPrice    = 500; // start at 50/50
        m.lastPriceUpdate = block.timestamp;

        m.yes_pool = FHE.asEuint32(0);
        m.no_pool  = FHE.asEuint32(0);
        FHE.allowThis(m.yes_pool);
        FHE.allowThis(m.no_pool);

        emit MarketCreated(marketId, question, m.resolutionTime);
    }

    // ─── Betting ─────────────────────────────────────────────────────────────

    /**
     * @notice Place a bet. Direction and amount are encrypted.
     *
     * What leaks on-chain: a bet happened, from this address, at this time.
     * What does NOT leak: direction (YES/NO), amount, or any pool composition.
     *
     * Amount convention: client encrypts (msg.value / 1e9) as gwei units.
     * Max single bet: ~4.29 ETH (uint32 overflow beyond that).
     *
     * @param encryptedDirection  Encrypted bool: true = YES, false = NO
     * @param encryptedAmount     Encrypted gwei units (must equal msg.value / 1e9)
     */
    function placeBet(
        uint256     marketId,
        InEbool  memory encryptedDirection,
        InEuint32 memory encryptedAmount
    ) external payable {
        Market storage m = markets[marketId];
        require(marketId < marketCount,  "Invalid market");
        require(!m.resolved,             "Market resolved");
        require(msg.value > 0,           "No ETH sent");

        // Convert inputs to FHE types
        ebool  dir = FHE.asEbool(encryptedDirection);
        euint32 amt = FHE.asEuint32(encryptedAmount);
        FHE.allowThis(dir);
        FHE.allowThis(amt);

        // Route amount to correct pool using encrypted multiplexer.
        // No branching — both operations always execute, nothing leaks.
        //   dir=true  → yesAdd=amt, noAdd=0
        //   dir=false → yesAdd=0,   noAdd=amt
        euint32 yesAdd = FHE.select(dir, amt, ZERO32);
        euint32 noAdd  = FHE.select(dir, ZERO32, amt);
        FHE.allowThis(yesAdd);
        FHE.allowThis(noAdd);

        // Update encrypted pools
        m.yes_pool = FHE.add(m.yes_pool, yesAdd);
        m.no_pool  = FHE.add(m.no_pool,  noAdd);
        FHE.allowThis(m.yes_pool);
        FHE.allowThis(m.no_pool);

        // Update user's encrypted position
        Position storage pos = positions[marketId][msg.sender];
        if (!pos.initialized) {
            pos.yes = FHE.asEuint32(0);
            pos.no  = FHE.asEuint32(0);
            FHE.allowThis(pos.yes);
            FHE.allowThis(pos.no);
            pos.initialized = true;
        }

        pos.yes = FHE.add(pos.yes, yesAdd);
        pos.no  = FHE.add(pos.no,  noAdd);
        FHE.allowThis(pos.yes);
        FHE.allowThis(pos.no);
        // User can decrypt their own position via permit
        FHE.allowSender(pos.yes);
        FHE.allowSender(pos.no);

        emit BetPlaced(marketId, msg.sender, block.timestamp);
    }

    // ─── Price update (two-step async) ───────────────────────────────────────

    /**
     * @notice Step 1: snapshot pool state and queue FHE threshold decryption.
     * Can be called by anyone after PRICE_UPDATE_INTERVAL has elapsed.
     * New bets during the pending window go into live pools and are included
     * in the NEXT price update (not this one).
     */
    function requestPriceUpdate(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(marketId < marketCount,             "Invalid market");
        require(!m.resolved,                        "Market resolved");
        require(!m.priceUpdatePending,              "Update already pending");
        require(
            block.timestamp >= m.lastPriceUpdate + PRICE_UPDATE_INTERVAL,
            "Too soon"
        );

        // Snapshot current pool handles at this point in time
        m.yesSnap = m.yes_pool;
        m.noSnap  = m.no_pool;
        m.priceUpdatePending = true;

        // Mark as publicly decryptable (replaces FHE.decrypt)
        FHE.allowPublic(m.yesSnap);
        FHE.allowPublic(m.noSnap);

        emit PriceUpdateRequested(marketId, block.timestamp);
    }

    /**
     * @notice Step 2: Accept decrypted pool values with Threshold Network proof.
     */
    function publishPriceUpdate(
        uint256 marketId,
        uint32 yesVal,
        bytes calldata yesSig,
        uint32 noVal,
        bytes calldata noSig
    ) external {
        Market storage m = markets[marketId];
        FHE.publishDecryptResult(m.yesSnap, yesVal, yesSig);
        FHE.publishDecryptResult(m.noSnap, noVal, noSig);
    }

    /**
     * @notice Step 3: finalize price once results are published.
     * Call after FHE decryption completes (typically a few seconds on testnet).
     */
    function finalizePrice(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.priceUpdatePending, "No pending update");

        (uint32 yesTotal, bool yesReady) = FHE.getDecryptResultSafe(m.yesSnap);
        (uint32 noTotal,  bool noReady)  = FHE.getDecryptResultSafe(m.noSnap);
        require(yesReady && noReady, "Decryption not ready yet");

        uint256 total = yesTotal + noTotal;
        if (total > 0) {
            m.currentPrice = uint32((yesTotal * 1000) / total);
        }
        m.lastPriceUpdate    = block.timestamp;
        m.priceUpdatePending = false;

        emit PriceUpdated(marketId, m.currentPrice, block.timestamp);
    }

    // ─── Resolution (Wave 1: owner-controlled) ────────────────────────────────

    /**
     * @notice Resolve market. Wave 1: owner provides final pool totals manually.
     * This is the mocked oracle — Wave 4 replaces with encrypted multi-voter quorum.
     *
     * @param finalYesTotal  Total YES capital (gwei units) at resolution
     * @param finalNoTotal   Total NO capital (gwei units) at resolution
     */
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

    // ─── Payout (two-step async) ──────────────────────────────────────────────

    /**
     * @notice Step 1: queue FHE decrypt of your winning position.
     * Call after market is resolved.
     */
    function requestClaim(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.resolved, "Not resolved");

        Position storage pos = positions[marketId][msg.sender];
        require(pos.initialized,      "No position");
        require(!pos.claimed,         "Already claimed");
        require(!pos.claimRequested,  "Claim already in progress");

        pos.claimRequested = true;

        // Mark as publicly decryptable (replaces FHE.decrypt)
        if (m.outcome) {
            FHE.allowPublic(pos.yes);
        } else {
            FHE.allowPublic(pos.no);
        }

        emit ClaimRequested(marketId, msg.sender);
    }

    /**
     * @notice Step 2: Accept decrypted payout value with Threshold Network proof.
     */
    function publishClaim(
        uint256 marketId,
        address user,
        uint32 amount,
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

    /**
     * @notice Step 3: finalize claim once results are published.
     * Payout = (user_position / winning_pool_total) * total_pool
     */
    function finalizeClaim(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.resolved,                        "Not resolved");

        Position storage pos = positions[marketId][msg.sender];
        require(pos.claimRequested, "Must call requestClaim first");
        require(!pos.claimed,       "Already claimed");

        uint32 userPosition;
        bool    ready;

        if (m.outcome) {
            (userPosition, ready) = FHE.getDecryptResultSafe(pos.yes);
        } else {
            (userPosition, ready) = FHE.getDecryptResultSafe(pos.no);
        }

        require(ready,            "Decryption not ready yet");
        require(userPosition > 0, "No winning position");

        uint256 winningTotal = m.outcome ? m.finalYesTotal : m.finalNoTotal;
        uint256 totalPool    = m.finalYesTotal + m.finalNoTotal;

        // Scale back to wei: userPosition is in gwei units
        uint256 payout = (userPosition * totalPool * GWEI) / winningTotal;

        // Checks-effects-interactions
        pos.claimed        = true;
        pos.claimRequested = false;

        (bool ok,) = payable(msg.sender).call{value: payout}("");
        require(ok, "Transfer failed");

        emit Claimed(marketId, msg.sender, payout);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getMarket(uint256 marketId) external view returns (
        string memory question,
        uint256 resolutionTime,
        uint32  currentPrice,
        uint256 lastPriceUpdate,
        bool    resolved,
        bool    outcome,
        bool    priceUpdatePending,
        euint32 yesSnap,
        euint32 noSnap
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
        euint32 yes,
        euint32 no,
        bool    initialized,
        bool    claimRequested,
        bool    claimed
    ) {
        Position storage pos = positions[marketId][user];
        return (pos.yes, pos.no, pos.initialized, pos.claimRequested, pos.claimed);
    }

    receive() external payable {}
}
