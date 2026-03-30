"use client";
/**
 * fhenixjs encryption helpers for OccultMarket.
 *
 * Encrypts direction (bool) and amount (uint32 gwei) client-side before
 * sending to placeBet(). Values are bound to the Fhenix CoFHE network's
 * public key — only threshold decryption can reveal them.
 */
import type { PublicClient, WalletClient } from "viem";

export type EncryptedInput = { ctHash: bigint };

export async function encryptBet(
  direction: boolean,
  amountGwei: bigint,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<{ encryptedDirection: EncryptedInput; encryptedAmount: EncryptedInput }> {
  // Dynamic import keeps fhenixjs client-side only (Next.js SSR safe)
  const { createFhenixClient, Encryptable } = await import("fhenixjs");

  const client = createFhenixClient({
    provider: publicClient as Parameters<typeof createFhenixClient>[0]["provider"],
    signer:   walletClient as Parameters<typeof createFhenixClient>[0]["signer"],
  });

  const [encryptedDirection, encryptedAmount] = await Promise.all([
    client.encrypt(Encryptable.bool(direction)),
    client.encrypt(Encryptable.uint32(amountGwei)),
  ]);

  return {
    encryptedDirection: encryptedDirection as EncryptedInput,
    encryptedAmount:    encryptedAmount    as EncryptedInput,
  };
}

export async function decryptHandle(
  ctHash: bigint,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<{ ctHash: bigint; decryptedValue: bigint; signature: `0x${string}` }> {
  const { createFhenixClient } = await import("fhenixjs");

  const client = createFhenixClient({
    provider: publicClient as Parameters<typeof createFhenixClient>[0]["provider"],
    signer:   walletClient as Parameters<typeof createFhenixClient>[0]["signer"],
  });

  const result = await client.decryptForTx(ctHash).withoutPermit().execute();
  return {
    ctHash: result.ctHash,
    decryptedValue: result.decryptedValue,
    signature: result.signature as `0x${string}`,
  };
}
