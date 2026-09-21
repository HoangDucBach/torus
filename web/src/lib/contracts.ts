import { parseAbi, type Address } from "viem";

/**
 * Addresses default to the live Arc Testnet deployment recorded at
 * contracts/deployments/5042002.json, overridable per-environment via NEXT_PUBLIC_* vars.
 */
export const addresses = {
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
    "0x3600000000000000000000000000000000000000") as Address,
  vault: (process.env.NEXT_PUBLIC_VAULT_ADDRESS ??
    "0xF87e393cdC523E69dE27e2E992225136d654273b") as Address,
  paymaster: (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS ??
    "0x497B7b6aAcB8a3372D569740c92ED53F75ED670B") as Address,
};

export const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:8787";

/** Minimal, hand-picked ABI surface — only what the frontend actually calls. */
export const vaultAbi = parseAbi([
  "function depositNative(address receiver) payable returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function getRate() view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256 assets)",
]);
