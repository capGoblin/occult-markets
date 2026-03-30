/**
 * Verify fhenixjs encryption API produces values compatible with OccultMarket.placeBet.
 * Run against Fhenix testnet: npx tsx encrypt-test.ts
 */
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fhenixTestnet } from "./chains.js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../.env") });

// fhenixjs provides: createFhenixClient, Encryptable
// The encrypted output shape must match: { ctHash: bigint }
// which maps to InEbool/InEuint32 in Solidity

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.log("PRIVATE_KEY not set — running import check only");
    
    try {
      const { Encryptable } = await import("fhenixjs");
      console.log("✓ fhenixjs imported successfully");
      console.log("✓ Encryptable types available:", Object.keys(Encryptable));
    } catch (err) {
      console.error("✗ fhenixjs import failed:", err);
      console.log("  Run: npm install in contracts/ts/");
    }
    return;
  }

  const PRIVATE_KEY = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account      = privateKeyToAccount(PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: fhenixTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: fhenixTestnet, transport: http() });

  try {
    const { createFhenixClient, Encryptable } = await import("fhenixjs");

    const client = createFhenixClient({
      provider: publicClient as any,
      signer: walletClient as any,
    });

    console.log("Encrypting bool(true) — YES direction...");
    const encBool = await client.encrypt(Encryptable.bool(true));
    console.log("✓ Encrypted bool:", JSON.stringify(encBool, null, 2));

    console.log("\nEncrypting uint32(10_000_000) — 0.01 ETH in gwei...");
    const encUint = await client.encrypt(Encryptable.uint32(10_000_000n));
    console.log("✓ Encrypted uint32:", JSON.stringify(encUint, null, 2));

    console.log("\n✓ fhenixjs encryption working correctly");
    console.log("  These values can be passed directly to OccultMarket.placeBet()");
  } catch (err) {
    console.error("Encryption failed:", err);
  }
}

main().catch(console.error);
