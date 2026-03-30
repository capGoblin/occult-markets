import { defineChain } from "viem";

export const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export const fhenixTestnet = defineChain({
  id: 8008135,
  name: "Fhenix Testnet",
  nativeCurrency: { name: "tFHE", symbol: "tFHE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.fhenix.zone:8747"] },
  },
  blockExplorers: {
    default: { name: "Fhenix Explorer", url: "https://explorer.testnet.fhenix.zone" },
  },
  testnet: true,
});

export function priceToPercent(price: number): string {
  return (price / 10).toFixed(1) + "%";
}

export function timeRemaining(resolutionTime: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const diff = resolutionTime - now;
  if (diff <= 0n) return "Ended";
  const days  = diff / 86400n;
  const hours = (diff % 86400n) / 3600n;
  if (days > 0n) return `${days}d ${hours}h`;
  const mins = (diff % 3600n) / 60n;
  return `${hours}h ${mins}m`;
}
