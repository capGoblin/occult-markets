/**
 * CLI keeper/interaction script for OccultMarket.
 *
 * Commands:
 *   npx tsx interact.ts get-market <id>
 *   npx tsx interact.ts update-price <id>
 *   npx tsx interact.ts finalize-price <id>
 *   npx tsx interact.ts resolve <id> <yes|no> <finalYesTotal> <finalNoTotal>
 */
import { createWalletClient, createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fhenixTestnet } from "./chains.js";
import { OCCULT_MARKET_ABI } from "./abi.js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../.env") });

const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
const rawKey = process.env.PRIVATE_KEY;
if (!rawKey) throw new Error("PRIVATE_KEY not set");
const PRIVATE_KEY = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;

const account       = privateKeyToAccount(PRIVATE_KEY);
const publicClient  = createPublicClient({ chain: fhenixTestnet, transport: http() });
const walletClient  = createWalletClient({ account, chain: fhenixTestnet, transport: http() });

const [,, cmd, ...args] = process.argv;

async function getMarket(id: bigint) {
  const result = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: OCCULT_MARKET_ABI,
    functionName: "getMarket",
    args: [id],
  });
  const [question, resolutionTime, currentPrice, lastPriceUpdate, resolved, outcome, priceUpdatePending] = result;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const remaining = resolutionTime > now ? resolutionTime - now : 0n;

  console.log(`\nMarket #${id}`);
  console.log("  Question:  ", question);
  console.log("  Price:     ", `${(currentPrice / 10).toFixed(1)}% YES`);
  console.log("  Remaining: ", remaining > 0n ? `${remaining / 3600n}h ${(remaining % 3600n) / 60n}m` : "ENDED");
  console.log("  Resolved:  ", resolved, resolved ? `(${outcome ? "YES" : "NO"} won)` : "");
  console.log("  Pending:   ", priceUpdatePending ? "Price update pending" : "None");
  console.log("  Last update:", new Date(Number(lastPriceUpdate) * 1000).toISOString());
}

async function updatePrice(id: bigint) {
  console.log(`Requesting price update for market #${id}...`);
  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: OCCULT_MARKET_ABI,
    functionName: "requestPriceUpdate",
    args: [id],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Price update requested. FHE decryption in progress...");
  console.log("Wait a few seconds, then run: npx tsx interact.ts finalize-price", id.toString());
}

async function finalizePrice(id: bigint) {
  console.log(`Finalizing price for market #${id}...`);
  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: OCCULT_MARKET_ABI,
    functionName: "finalizePrice",
    args: [id],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Price finalized. Tx:", receipt.transactionHash);
}

async function resolveMarket(id: bigint, outcome: boolean, yesTotal: bigint, noTotal: bigint) {
  console.log(`Resolving market #${id} → ${outcome ? "YES" : "NO"}`);
  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: OCCULT_MARKET_ABI,
    functionName: "resolve",
    args: [id, outcome, yesTotal, noTotal],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Market resolved.");
}

async function main() {
  if (!cmd || !args[0]) {
    console.log("Usage:");
    console.log("  npx tsx interact.ts get-market <id>");
    console.log("  npx tsx interact.ts update-price <id>");
    console.log("  npx tsx interact.ts finalize-price <id>");
    console.log("  npx tsx interact.ts resolve <id> <yes|no> <yesTotal> <noTotal>");
    process.exit(0);
  }

  const id = BigInt(args[0]);

  switch (cmd) {
    case "get-market":     await getMarket(id); break;
    case "update-price":   await updatePrice(id); break;
    case "finalize-price": await finalizePrice(id); break;
    case "resolve":
      if (!args[1] || !args[2] || !args[3]) {
        console.error("resolve requires: <id> <yes|no> <yesTotal> <noTotal>");
        process.exit(1);
      }
      await resolveMarket(id, args[1] === "yes", BigInt(args[2]), BigInt(args[3]));
      break;
    default:
      console.error("Unknown command:", cmd);
  }
}

main().catch(console.error);
