import { parseAbi } from "viem";

export const vaultAbi = parseAbi([
  "function depositNative(address receiver) payable returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function getRate() view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256 assets)",
]);

export const counterAbi = parseAbi([
  "function increment() returns (uint256)",
  "function count() view returns (uint256)",
]);
