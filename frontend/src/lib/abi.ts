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
      {
        name: "encryptedDirection",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ]
      },
      {
        name: "encryptedAmount",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ]
      },
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
    name: "publishPriceUpdate", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "yesVal",   type: "uint32"  },
      { name: "yesSig",   type: "bytes"   },
      { name: "noVal",    type: "uint32"  },
      { name: "noSig",    type: "bytes"   },
    ],
    outputs: [],
  },
  {
    name: "resolve", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" }, { name: "outcome", type: "bool" },
      { name: "finalYesTotal", type: "uint256" }, { name: "finalNoTotal", type: "uint256" },
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
    name: "publishClaim", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "user",     type: "address" },
      { name: "amount",   type: "uint32"  },
      { name: "signature",type: "bytes"   },
    ],
    outputs: [],
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
      { name: "yesSnap",            type: "uint256" },
      { name: "noSnap",             type: "uint256" },
    ],
  },
  {
    name: "getPosition", type: "function", stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }, { name: "user", type: "address" }],
    outputs: [
      { name: "yes", type: "uint256" }, { name: "no", type: "uint256" },
      { name: "initialized", type: "bool" }, { name: "claimRequested", type: "bool" },
      { name: "claimed", type: "bool" },
    ],
  },
  {
    name: "marketCount", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "BetPlaced", type: "event",
    inputs: [
      { name: "marketId",  type: "uint256", indexed: true  },
      { name: "bettor",    type: "address", indexed: true  },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "PriceUpdated", type: "event",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true  },
      { name: "newPrice", type: "uint32",  indexed: false },
      { name: "timestamp",type: "uint256", indexed: false },
    ],
  },
  {
    name: "MarketResolved", type: "event",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true  },
      { name: "outcome",  type: "bool",    indexed: false },
    ],
  },
] as const;
