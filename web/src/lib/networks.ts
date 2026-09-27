import { defineChain, type Address, type Chain } from "viem";

export type NetworkId = "testnet" | "mainnet";

export type NetworkConfig = {
  id: NetworkId;
  label: string;
  chain: Chain;
  serverUrl: string;
  explorerUrl: string;
  /** A bundler that supports this network + EIP-7702 (e.g. Pimlico) — only needed by /gasless. */
  bundlerUrl?: string;
  addresses: {
    usdc: Address;
    vault: Address;
    /** EntryPoint v0.7 paymaster — deployed smart accounts (SimpleAccount, Kernel, Safe, ...). */
    paymaster: Address;
    /** EntryPoint v0.8 paymaster — EIP-7702 accounts, used by /gasless. */
    paymasterV08: Address;
    /** ExampleCounter, the /gasless demo's third-party contract. */
    counter: Address;
  };
};

// Same USDC precompile address on both networks (docs.arc.io/arc/references/evm-differences).
const USDC: Address = "0x3600000000000000000000000000000000000000";

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  testnet: {
    id: "testnet",
    label: "Testnet",
    chain: defineChain({
      id: 5_042_002,
      name: "Arc Testnet",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
      rpcUrls: {
        default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL_TESTNET ?? "https://rpc.testnet.arc.io"] },
      },
      blockExplorers: {
        default: { name: "Arc Testnet Explorer", url: "https://explorer.testnet.arc.io" },
      },
      testnet: true,
    }),
    serverUrl: process.env.NEXT_PUBLIC_SERVER_URL_TESTNET ?? "http://localhost:8787",
    explorerUrl: "https://explorer.testnet.arc.io",
    bundlerUrl: process.env.NEXT_PUBLIC_BUNDLER_URL_TESTNET ?? process.env.NEXT_PUBLIC_BUNDLER_URL,
    addresses: {
      usdc: USDC,
      vault: (process.env.NEXT_PUBLIC_VAULT_ADDRESS_TESTNET ??
        "0xF87e393cdC523E69dE27e2E992225136d654273b") as Address,
      paymaster: (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS_TESTNET ??
        "0x497B7b6aAcB8a3372D569740c92ED53F75ED670B") as Address,
      paymasterV08: (process.env.NEXT_PUBLIC_PAYMASTER_V08_ADDRESS_TESTNET ??
        "0xA49e84E73aE841DAc8A80CfD8fB11BD09a8B17AC") as Address,
      counter: (process.env.NEXT_PUBLIC_COUNTER_ADDRESS_TESTNET ??
        "0x7d2b774D9cdBB6f3c69AC7be97E633fA911b8e66") as Address,
    },
  },
  mainnet: {
    id: "mainnet",
    label: "Mainnet",
    chain: defineChain({
      id: 5_042,
      name: "Arc",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
      rpcUrls: {
        default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL_MAINNET ?? "https://rpc.mainnet.arc.io"] },
      },
      blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
    }),
    serverUrl: process.env.NEXT_PUBLIC_SERVER_URL_MAINNET ?? "http://localhost:8788",
    explorerUrl: "https://explorer.arc.io",
    bundlerUrl: process.env.NEXT_PUBLIC_BUNDLER_URL_MAINNET,
    addresses: {
      usdc: USDC,
      vault: (process.env.NEXT_PUBLIC_VAULT_ADDRESS_MAINNET ??
        "0xF87e393cdC523E69dE27e2E992225136d654273b") as Address,
      paymaster: (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS_MAINNET ??
        "0x497B7b6aAcB8a3372D569740c92ED53F75ED670B") as Address,
      paymasterV08: (process.env.NEXT_PUBLIC_PAYMASTER_V08_ADDRESS_MAINNET ??
        "0x4Eaf8e9c74DeC33e7D4c71ED81B8CD3A6687A2dF") as Address,
      counter: (process.env.NEXT_PUBLIC_COUNTER_ADDRESS_MAINNET ??
        "0x230bcd175ce42E1B1eA0dd4B5a488DAEae59e346") as Address,
    },
  },
};

export const DEFAULT_NETWORK: NetworkId =
  process.env.NEXT_PUBLIC_ARC_NETWORK === "mainnet" ? "mainnet" : "testnet";
