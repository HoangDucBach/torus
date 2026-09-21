import { createPublicClient, http } from "viem";
import { chain, rpcUrl } from "./env.ts";

export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});
