export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Torus Protocol API",
    version: "1.0.0",
    description:
      "ERC-7677 paymaster RPC plus read-only stats/quote/position endpoints for Torus, a yield-bearing USDC vault on Arc. The /paymaster endpoint is the entire integration surface for third-party protocols — see examples/gasless-demo.",
  },
  servers: [{ url: "http://localhost:8787", description: "Local / configured server" }],
  paths: {
    "/": {
      get: {
        summary: "Server info",
        responses: {
          "200": {
            description: "Network and deployment info",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", example: "torus-server" },
                    network: { type: "string", example: "testnet" },
                    vault: { type: "string", example: "0xF87e393cdC523E69dE27e2E992225136d654273b" },
                    paymaster: { type: "string", example: "0x497B7b6aAcB8a3372D569740c92ED53F75ED670B" },
                    endpoints: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/paymaster": {
      post: {
        summary: "ERC-7677 paymaster RPC",
        description:
          "Implements pm_getPaymasterStubData and pm_getPaymasterData. Pricing comes from the vault's own exchange rate, so both methods return the same payload; params[1] (entryPoint) selects which Torus paymaster (v0.7 or v0.8) to use.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["jsonrpc", "id", "method", "params"],
                properties: {
                  jsonrpc: { type: "string", example: "2.0" },
                  id: { type: "integer", example: 1 },
                  method: {
                    type: "string",
                    enum: ["pm_getPaymasterStubData", "pm_getPaymasterData"],
                  },
                  params: {
                    type: "array",
                    description: "[userOp, entryPoint, chainId, context?]",
                    items: {},
                    example: [
                      { sender: "0x0000000000000000000000000000000000dEaD" },
                      "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108",
                      5042002,
                      {},
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "JSON-RPC response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    jsonrpc: { type: "string", example: "2.0" },
                    id: { type: "integer", example: 1 },
                    result: {
                      type: "object",
                      properties: {
                        paymaster: { type: "string" },
                        paymasterData: { type: "string", example: "0x" },
                        paymasterVerificationGasLimit: { type: "string" },
                        paymasterPostOpGasLimit: { type: "string" },
                        isFinal: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/position": {
      get: {
        summary: "Per-address deposit/withdraw cost basis",
        description:
          "Aggregated from the vault's own Deposit/Withdraw events — see server/src/position.ts.",
        parameters: [
          {
            name: "address",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "A valid 0x address",
          },
        ],
        responses: {
          "200": {
            description: "Cost basis for the address",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    depositedTotal: { type: "string", description: "USDC, 6 decimals" },
                    withdrawnTotal: { type: "string", description: "USDC, 6 decimals" },
                  },
                },
              },
            },
          },
          "400": { description: "Missing or invalid address query param" },
        },
      },
    },
    "/quote": {
      get: {
        summary: "Estimated torUSDC cost for a UserOperation",
        description: "Uses the same pricing TorusPaymaster applies on-chain.",
        parameters: [
          { name: "gas", in: "query", required: true, schema: { type: "string" }, description: "Gas units" },
          {
            name: "maxFeePerGas",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Wei",
          },
        ],
        responses: {
          "200": {
            description: "Quote",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    nativeCostWei: { type: "string" },
                    tokenPerNative: { type: "string" },
                    torUsdcShares: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "Missing gas or maxFeePerGas query param" },
        },
      },
    },
    "/stats": {
      get: {
        summary: "Protocol-wide vault and paymaster numbers",
        responses: {
          "200": {
            description: "Live on-chain stats",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    chainId: { type: "string" },
                    vault: { type: "string" },
                    paymaster: { type: "string" },
                    totalAssets: { type: "string", description: "USDC, 6 decimals" },
                    totalSupply: { type: "string", description: "torUSDC, 18 decimals" },
                    rate: { type: "string", description: "convertToAssets(1e18), 18 decimals" },
                    performanceFeeBps: { type: "integer" },
                    spreadBps: { type: "integer" },
                    strategy: {
                      type: "object",
                      properties: {
                        address: { type: "string" },
                        totalAssets: { type: "string" },
                        reserve: { type: "string" },
                      },
                    },
                    paymasterEntryPointDeposit: { type: "string", description: "native wei" },
                    gasSponsored: {
                      type: "object",
                      properties: {
                        totalTorUsdcCharged: { type: "string" },
                        userOperationCount: { type: "integer" },
                      },
                    },
                    eip7702: {
                      type: "object",
                      nullable: true,
                      properties: {
                        entryPoint: { type: "string" },
                        paymaster: { type: "string" },
                        paymasterEntryPointDeposit: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
