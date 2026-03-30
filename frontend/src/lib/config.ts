import { arbitrumSepolia } from "viem/chains";

export const CONTRACT_ADDRESS = "0xd8fE03483eBD70FbFc4b007cb98Bf090e7C5fc70" as `0x${string}`;

export const targetNetwork = arbitrumSepolia;

export function priceToPercent(price: number): string {
  return (price / 10).toFixed(1) + "%";
}

export function timeRemaining(resolutionTime: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const diff = resolutionTime - now;
  if (diff <= BigInt(0)) return "Ended";
  const days  = diff / BigInt(86400);
  const hours = (diff % BigInt(86400)) / BigInt(3600);
  if (days > BigInt(0)) return `${days}d ${hours}h`;
  const mins = (diff % BigInt(3600)) / BigInt(60);
  return `${hours}h ${mins}m`;
}
