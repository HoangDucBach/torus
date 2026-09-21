import { parseAbi, type Address } from "viem";

// See ../../contracts/src/ExampleCounter.sol.
export const counterAddress = (process.env.NEXT_PUBLIC_COUNTER_ADDRESS ??
  "0x7d2b774D9cdBB6f3c69AC7be97E633fA911b8e66") as Address;

export const counterAbi = parseAbi([
  "function increment() returns (uint256)",
  "function count() view returns (uint256)",
]);

export const torusServerUrl = process.env.NEXT_PUBLIC_TORUS_SERVER_URL ?? "http://localhost:8787";
