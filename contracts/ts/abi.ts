export const OCCULT_MARKET_ABI = [
  {
    name: "createMarket", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "question", type: "string" }, { name: "duration", type: "uint256" }],
    outputs: [{ name: "marketId", type: "uint256" }],
  },
  {
    name: "placeBet", type: "function", stateMutability: "payable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "encryptedDirection", type: "tuple", components: [{ name: "ctHash", type: "uint256" }] },
      { name: "encryptedAmount",    type: "tuple", components: [{ name: "ctHash", type: "uint256" }] },
    ],
    outputs: [],
  },
  {
    name: "requestPriceUpdate", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint256" }], outputs: [],
  },
  {
    name: "finalizePrice", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint256" }], outputs: [],
  },
  {
    name: "resolve", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "marketId",      type: "uint256" },
      { name: "outcome",       type: "bool" },
      { name: "finalYesTotal", type: "uint256" },
      { name: "finalNoTotal",  type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "requestClaim", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint256" }], outputs: [],
  },
  {
    name: "finalizeClaim", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint256" }], outputs: [],
  },
  {
    name: "getMarket", type: "function", stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      { name: "question",           type: "string"  },
      { name: "resolutionTime",     type: "uint256" },
      { name: "currentPrice",       type: "uint32"  },
      { name: "lastPriceUpdate",    type: "uint256" },
      { name: "resolved",           type: "bool"    },
      { name: "outcome",            type: "bool"    },
      { name: "priceUpdatePending", type: "bool"    },
    ],
  },
  {
    name: "marketCount", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }],
  },
] as const;
