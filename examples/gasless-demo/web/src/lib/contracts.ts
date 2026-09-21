import { parseAbi, type Address } from "viem";

/** ExampleCounter — a stand-in for any unrelated third-party protocol's contract. It has no
 * knowledge of Torus; that's the point of this demo. See ../../contracts/src/ExampleCounter.sol. */
export const counterAddress = (process.env.NEXT_PUBLIC_COUNTER_ADDRESS ??
  "0x7d2b774D9cdBB6f3c69AC7be97E633fA911b8e66") as Address;

export const counterAbi = parseAbi([
  "function increment() returns (uint256)",
  "function count() view returns (uint256)",
]);

/** Torus's own server — this demo only needs its ERC-7677 paymaster RPC, nothing else. */
export const torusServerUrl = process.env.NEXT_PUBLIC_TORUS_SERVER_URL ?? "http://localhost:8787";
