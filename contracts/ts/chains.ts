import { defineChain } from "viem";
import "dotenv/config";

export const fhenixTestnet = defineChain({
  id: 8008135,
  name: "Fhenix Testnet",
  nativeCurrency: { name: "tFHE", symbol: "tFHE", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.FHENIX_RPC_URL ?? "https://testnet.fhenix.zone:8747"],
    },
  },
  blockExplorers: {
    default: {
      name: "Fhenix Explorer",
      url: "https://explorer.testnet.fhenix.zone",
    },
  },
  testnet: true,
});
