# 🌑 Occult Markets

> **The most accurate prediction market ever to exist. Price reflects what people believe — not what they believe other traders believe.**

**[Live App](https://occult-markets.vercel.app)** · **[Contract on Arbiscan](https://sepolia.arbiscan.io/address/0xd8fE03483eBD70FbFc4b007cb98Bf090e7C5fc70)** · **[Fhenix CoFHE](https://fhenix.io)**

---

## The Problem

Prediction markets are supposed to aggregate dispersed private information into accurate prices.

They fail. Here's exactly why.

On Polymarket, every trade is permanently visible — direction, size, timing, wallet. Sophisticated actors don't predict events. They predict how other traders will react to events. They follow smart money wallets. They front-run large positions. They trade price momentum. The price becomes a reflection of trader behavior, not underlying reality.

Keynes identified this in 1936. He called it the **beauty contest problem**: in a beauty contest, you don't pick the face you think is most beautiful — you pick the face you think *other judges* will think is most beautiful. Every prediction market since has had this problem. Nobody has structurally fixed it.

The result: the most informed people — researchers, analysts, people who genuinely know something — hold back. They bet below conviction. They fragment positions across wallets. Some don't participate at all. Because deploying full conviction publicly *is* giving your edge away.

**Market prices reflect what traders are willing to reveal publicly. Not what they actually believe. These are completely different things.**

---

## The Fix

**Occult encrypts the pool state itself.**

Not just who bet. The bet.

`yes_pool` and `no_pool` are `euint64` ciphertexts on Fhenix CoFHE. Every trade updates the pools via homomorphic addition on ciphertexts. Nobody — not other traders, not the protocol, not Fhenix nodes — can read pool composition between price updates.

Price updates every N trades (Wave 2+) or every 10 minutes (Wave 1). One number published: the new market price. Individual trades are permanently invisible.

This kills two things simultaneously:

**The meta-game dies.** No price signal between updates means no momentum to trade, no flow to front-run, nothing for the meta-game to run on. Every participant is forced to form a genuine view on the underlying event. The beauty contest becomes an actual prediction.

**Informed capital flows freely.** Direction is encrypted. Pool state is invisible. Price doesn't move between updates. A researcher with 200 hours of genuine edge deploys full conviction in one transaction. Nothing leaks. Their information enters the market completely — not strategically rationed.

**The consequence: our prices reflect what informed people actually believe. Not what they're willing to publicly commit to. That difference is accuracy.**

---

## Why FHE — Not ZK, Not TEE

**ZK** proves state transitions happened correctly but the *state itself* must be readable. Pool totals must be public for ZK verification. ZK can hide who bet. It cannot hide that a bet moved the pool.

**TEE** (Intel SGX) requires trusting the hardware manufacturer. Side-channel attacks exist. A trustless prediction market that trusts Intel is not actually trustless.

**MPC** requires all parties online simultaneously and interactively. Prediction market participants are async by nature. Breaks down.

**FHE** is the only mechanism where pool state is a ciphertext, computation happens on ciphertexts, and the only decryption is the periodic price reveal. Mathematically trustless. No hardware trust. No interactivity required.

---

## The Key Architecture Decision

Instant price updates after every trade would destroy the privacy guarantee entirely.

The FPMM formula is public math. If price updates after every trade, an observer knows pool state before and after each trade and solves for exact size:

```
Before: yes_pool=$50,000  no_pool=$30,000  price=62.5%
After:  new_price=62.9%

→ (50,000 + x) / (80,000 + x) = 0.629
→ x = $862 — exact trade size extracted
```

Direction is also free: price went up = YES bet. The encrypted pool state becomes completely irrelevant. Price movement *is* the pool state delta.

**Batched updates make this impossible.** N trades happen. One price update. One equation, N unknowns. Individual trades permanently invisible. Deliberate UX tradeoff — you don't see a live price tick with every trade. What you get is the only prediction market where price movement reveals nothing about who moved it or by how much.

---

## How It Works

```
User encrypts direction (YES/NO) + amount client-side via CoFHE SDK
         ↓
placeBet(marketId, Enc(direction), Enc(amount))
         ↓
FHE.select() routes amount to correct pool — no branching, no signal
yes_pool += Enc(yesAdd)   no_pool += Enc(noAdd)
         ↓
Price frozen at last settled value
         ↓
[10 minutes / 15 trades later]
         ↓
requestPriceUpdate() → FHE.allowPublic() → threshold decryption queued
publishPriceUpdate() → submits threshold network proof on-chain
finalizePrice() → FHE.getDecryptResultSafe() → new price published
         ↓
One number revealed: new probability %
Everything else: permanently invisible
```

On-chain record of any bet: *a bet happened, from this address, at this timestamp.* Direction unknown. Amount unknown. Pool impact unknown.

---

## Contract Architecture

```
contracts/
└── OccultMarket.sol
    ├── euint64 yes_pool          — encrypted YES capital
    ├── euint64 no_pool           — encrypted NO capital
    ├── mapping(address → Position)
    │   ├── euint64 yes           — user's encrypted YES position
    │   └── euint64 no            — user's encrypted NO position
    ├── placeBet()                — single function, encrypted direction + amount
    ├── requestPriceUpdate()      — snapshot + queue threshold decrypt
    ├── publishPriceUpdate()      — submit threshold network proof
    ├── finalizePrice()           — publish decrypted price
    ├── resolve()                 — owner-controlled (Wave 1), encrypted quorum (Wave 4)
    ├── requestClaim()            — queue decrypt of winning position
    └── finalizeClaim()           — compute and send payout
```

**Deployed:** `0xd8fE03483eBD70FbFc4b007cb98Bf090e7C5fc70` on Arbitrum Sepolia

---

## Why `placeBet()` — Not `buyYes()` / `buyNo()`

Function names in calldata are permanently public on-chain. Separate `buyYes()` and `buyNo()` would expose direction in every transaction. Single `placeBet()` with encrypted direction routes via `FHE.select()`:

```solidity
ebool  dir    = FHE.asEbool(encryptedDirection);
euint64 amt   = FHE.asEuint64(encryptedAmount);

euint64 yesAdd = FHE.select(dir, amt, ZERO64);
euint64 noAdd  = FHE.select(dir, ZERO64, amt);

m.yes_pool = FHE.add(m.yes_pool, yesAdd);
m.no_pool  = FHE.add(m.no_pool,  noAdd);
```

No branching. No gas signal. No calldata leak. The operation is identical regardless of which direction was chosen.

---

## Repo Structure

```
occult-markets/
├── contracts/                    — Foundry environment
│   ├── src/
│   │   └── OccultMarket.sol      — core encrypted AMM
│   ├── test/
│   │   └── OccultMarket.t.sol
│   └── foundry.toml
├── frontend/                     — Next.js app
│   └── src/
│       ├── app/
│       ├── components/
│       │   ├── MarketCard.tsx    — market display + price update flow
│       │   └── BetForm.tsx       — encrypts direction + amount via CoFHE SDK
│       └── lib/
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js v20+
- pnpm
- Private key with Arbitrum Sepolia ETH ([faucet](https://faucet.triangleplatform.com/arbitrum/sepolia))

### Contracts

```bash
cd contracts
npm install

# Deploy to Arbitrum Sepolia
cp .env.example .env
# Add PRIVATE_KEY to .env
npx ts-node ts/deploy.ts
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env.local` to your deployed contract address.

---

## Wave Roadmap

| Wave | Status | Shipped |
|------|--------|---------|
| **Wave 1** | ✅ Done | Encrypted AMM core — `euint64` pools, `placeBet()` with encrypted direction, batched price updates, encrypted claims |
| **Wave 2** | 🔨 Building | Exits, multiple markets, volume-triggered price updates (15 trades min, 6hr fallback) |
| **Wave 3** | 📋 Planned | Encrypted position history proof, multi-outcome markets (3-5 outcomes), LP mechanics |
| **Wave 4** | 📋 Planned | Encrypted multi-voter resolution — votes are ciphertexts, FHE tallies, incorrect voters slashed. Encrypted limit orders |
| **Wave 5** | 📋 Planned | Institutional API. Accuracy comparison vs Polymarket — empirical proof that encrypted pool state produces more accurate prices |

---

## Honest Limitations (Wave 1)

**Oracle:** Resolution is `onlyOwner`. Owner manually provides outcome. Decentralized encrypted multi-voter quorum ships in Wave 4.

**LP System:** Initial liquidity depth is fixed. Dynamic LP mechanics with encrypted LP positions ship in Wave 2.

**Price update interval:** Hardcoded 10 minutes. Volume-triggered updates (15 trades minimum, 6-hour fallback) ship in Wave 2.

---

## Tech Stack

- **[Fhenix CoFHE](https://fhenix.io)** — FHE coprocessor on Arbitrum Sepolia
- **[@fhenixprotocol/cofhe-contracts](https://github.com/FhenixProtocol/cofhe-contracts)** — Solidity FHE library (`euint64`, `ebool`, `FHE.select`, `FHE.add`, `FHE.allowPublic`, `FHE.getDecryptResultSafe`)
- **[@cofhe/sdk](https://www.npmjs.com/package/@cofhe/sdk)** — Client-side encryption and permit-based decryption
- **[Foundry](https://getfoundry.sh)** — Smart contract development and testing
- **Arbitrum Sepolia** — Deployment network
- **Next.js** — Frontend

---

## Resources

- [Fhenix Docs](https://docs.fhenix.io)
- [CoFHE Quick Start](https://cofhe-docs.fhenix.zone/fhe-library/introduction/quick-start)
- [CoFHE Architecture](https://cofhe-docs.fhenix.zone/deep-dive/cofhe-components/overview)
- [Live App](https://occult-markets.vercel.app)
- [Contract](https://sepolia.arbiscan.io/address/0xd8fE03483eBD70FbFc4b007cb98Bf090e7C5fc70)

---

*Built for the [Fhenix Privacy-by-Design dApp Buildathon](https://app.akindo.io/wave-hacks/Nm2qjzEBgCqJD90W)*