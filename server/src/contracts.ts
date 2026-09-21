import { parseAbi, type Address } from "viem";
import { deployment } from "./env.ts";

export const addresses = deployment;

/**
 * Torus runs one paymaster per EntryPoint version it supports: v0.7 for deployed smart accounts
 * (SimpleAccount, Kernel, Safe, ...) and v0.8 for EIP-7702 accounts (an EOA has no separate
 * deployed contract, so it must target the version its delegated code — Simple7702Account —
 * expects). ERC-7677 requests carry the caller's target `entryPoint`, so the paymaster route
 * looks it up here rather than hardcoding a single address for every request.
 */
export function paymasterForEntryPoint(entryPoint: Address): Address | undefined {
  const normalized = entryPoint.toLowerCase();
  if (normalized === addresses.entryPoint.toLowerCase()) return addresses.paymaster;
  if (addresses.entryPointV08 && normalized === addresses.entryPointV08.toLowerCase()) {
    return addresses.paymasterV08;
  }
  return undefined;
}

/** Minimal, hand-picked ABI surface — only what this server actually calls. */
export const vaultAbi = parseAbi([
  "function asset() view returns (address)",
  "function decimals() view returns (uint8)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function getRate() view returns (uint256)",
  "function performanceFeeBps() view returns (uint16)",
  "function gasSpender() view returns (address)",
  "function harvest() returns (uint256)",
]);

export const strategyAbi = parseAbi([
  "function totalAssets() view returns (uint256)",
  "function reserve() view returns (uint256)",
  "function accrue() returns (uint256)",
]);

export const paymasterAbi = parseAbi([
  "function entryPoint() view returns (address)",
  "function spreadBps() view returns (uint16)",
  "function refuel() returns (uint256 assetsRedeemed, uint256 nativeDeposited)",
]);

export const entryPointAbi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
]);
