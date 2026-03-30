/**
 * Deploy OccultMarket and create the first market.
 * Usage: npx tsx deploy.ts
 *
 * Requires: PRIVATE_KEY in ../.env (relative to contracts/)
 */
import { createWalletClient, createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fhenixTestnet } from "./chains.js";
import { OCCULT_MARKET_ABI } from "./abi.js";
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";

config({ path: resolve(process.cwd(), "../.env") });

const rawKey = process.env.PRIVATE_KEY;
if (!rawKey) throw new Error("PRIVATE_KEY not set in contracts/.env");
const PRIVATE_KEY = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;

const account       = privateKeyToAccount(PRIVATE_KEY);
const publicClient  = createPublicClient({ chain: fhenixTestnet, transport: http() });
const walletClient  = createWalletClient({ account, chain: fhenixTestnet, transport: http() });

async function main() {
  console.log("Deployer:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance: ", formatEther(balance), "tFHE\n");

  // Read bytecode from Foundry artifacts (run `forge build` first)
  let bytecode: `0x${string}`;
  try {
    const artifact = JSON.parse(
      readFileSync(resolve(process.cwd(), "../out/OccultMarket.sol/OccultMarket.json"), "utf-8")
    );
    bytecode = artifact.bytecode.object as `0x${string}`;
    console.log("Loaded bytecode from forge artifacts");
  } catch {
    console.error("Run `forge build` in contracts/ first to generate artifacts.");
    process.exit(1);
  }

  // Deploy
  const deployHash = await walletClient.deployContract({
    abi: OCCULT_MARKET_ABI,
    bytecode,
    args: [],
  });
  console.log("Deploy tx:", deployHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const contractAddress = receipt.contractAddress!;
  console.log("Deployed to:", contractAddress);

  // Create first market
  const createHash = await walletClient.writeContract({
    address: contractAddress,
    abi: OCCULT_MARKET_ABI,
    functionName: "createMarket",
    args: ["Will ETH hit $4000 before June 1 2025?", BigInt(60 * 24 * 60 * 60)],
  });
  await publicClient.waitForTransactionReceipt({ hash: createHash });
  console.log("Market 0 created");

  console.log("\n─────────────────────────────────────────");
  console.log("Update frontend/src/lib/config.ts:");
  console.log(`  CONTRACT_ADDRESS = "${contractAddress}"`);
  console.log("─────────────────────────────────────────");
}

main().catch(console.error);
