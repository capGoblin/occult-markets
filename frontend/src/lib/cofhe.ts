"use client";
import type { PublicClient, WalletClient } from "viem";
import { createCofheConfig, createCofheClient } from '@cofhe/sdk/web';
import { Encryptable } from '@cofhe/sdk';
import { chains } from '@cofhe/sdk/chains';
import { WagmiAdapter } from '@cofhe/sdk/adapters';
import { CONTRACT_ADDRESS } from '@/lib/config';

/**
 * Matches the InEuint / InEbool structs in FHE.sol
 */
export type EncryptedInput = {
  ctHash: bigint;
  securityZone: number;
  utype: number;
  signature: `0x${string}`;
};

let cachedCofheClient: ReturnType<typeof createCofheClient> | null = null;

async function getCofheClient(publicClient: PublicClient, walletClient: WalletClient) {
  if (!cachedCofheClient) {
    const config = createCofheConfig({ supportedChains: [chains.arbSepolia] });
    cachedCofheClient = createCofheClient(config);
  }
  
  // @ts-ignore - adapter type mismatch in some viem versions
  const { publicClient: pc, walletClient: wc } = await WagmiAdapter(walletClient, publicClient);
  
  await cachedCofheClient.connect(pc as any, wc as any);
  return { client: cachedCofheClient, wc: wc as WalletClient };
}

export async function processFheBet(
  marketId: bigint,
  direction: boolean,
  amountGwei: bigint,
  amountWei: bigint,
  account: `0x${string}`,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<`0x${string}`> {
  const { client, wc } = await getCofheClient(publicClient, walletClient);

  const [encryptedDirection, encryptedAmount] = await client
    .encryptInputs([
      Encryptable.bool(direction),
      Encryptable.uint64(amountGwei)
    ])
    .execute();

  // Route the write payload natively through the intercepted Wagmi Adapter wallet client
  const txHash = await wc.writeContract({
    address: CONTRACT_ADDRESS,
    abi: require("./abi").OCCULT_MARKET_ABI,
    functionName: "placeBet",
    args: [
      marketId,
      encryptedDirection as unknown as EncryptedInput,
      encryptedAmount as unknown as EncryptedInput
    ],
    value: amountWei,
    account: account,
    chain: chains.arbSepolia as any,
    gas: BigInt(3000000),
    maxFeePerGas: BigInt(500000000), // 0.5 gwei safety override
    maxPriorityFeePerGas: BigInt(500000000),
  });

  return txHash;
}

export async function decryptHandle(
  ctHash: bigint,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<{ ctHash: bigint; decryptedValue: bigint; signature: `0x${string}` }> {
  const { client } = await getCofheClient(publicClient, walletClient);

  const result = await (client as any).decryptForTx(ctHash).withoutPermit().execute();
  
  return {
    ctHash: result.ctHash,
    decryptedValue: result.decryptedValue,
    signature: result.signature as `0x${string}`,
  };
}
