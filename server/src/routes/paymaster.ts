import { Hono } from "hono";
import { numberToHex, type Address } from "viem";
import { paymasterForEntryPoint } from "../contracts.ts";

/**
 * ERC-7677 (`pm_*`) paymaster RPC. Pricing comes from the vault's own exchange rate, so there's
 * no signature or per-request state — `pm_getPaymasterStubData`/`pm_getPaymasterData` return
 * the same payload, and `params[1]` (entryPoint) picks which paymaster (v0.7 or v0.8) to use.
 */
export const paymasterRoute = new Hono();

// postOp does one torUSDC balance write; 60_000 covers it plus the unused-gas-penalty margin.
const PAYMASTER_VERIFICATION_GAS_LIMIT = 150_000n;
const PAYMASTER_POST_OP_GAS_LIMIT = 60_000n;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number | string | null;
  method: string;
  params?: unknown[];
};

function paymasterStubResult(paymaster: Address) {
  return {
    paymaster,
    paymasterData: "0x" as const,
    paymasterVerificationGasLimit: numberToHex(PAYMASTER_VERIFICATION_GAS_LIMIT),
    paymasterPostOpGasLimit: numberToHex(PAYMASTER_POST_OP_GAS_LIMIT),
    isFinal: true,
  };
}

function paymasterDataResult(paymaster: Address) {
  return {
    paymaster,
    paymasterData: "0x" as const,
  };
}

paymasterRoute.post("/", async (c) => {
  const body = (await c.req.json()) as JsonRpcRequest;

  const respond = (result: unknown) => c.json({ jsonrpc: "2.0", id: body.id, result });
  const respondError = (code: number, message: string) =>
    c.json({ jsonrpc: "2.0", id: body.id, error: { code, message } }, 200);

  const requestedEntryPoint = body.params?.[1] as Address | undefined;

  switch (body.method) {
    case "pm_getPaymasterStubData":
    case "pm_getPaymasterData": {
      if (!requestedEntryPoint) {
        return respondError(-32602, "params[1] (entryPoint) is required");
      }
      const paymaster = paymasterForEntryPoint(requestedEntryPoint);
      if (!paymaster) {
        return respondError(
          -32000,
          `No Torus paymaster configured for EntryPoint ${requestedEntryPoint}`
        );
      }
      return respond(
        body.method === "pm_getPaymasterStubData"
          ? paymasterStubResult(paymaster)
          : paymasterDataResult(paymaster)
      );
    }
    default:
      return respondError(-32601, `Method not found: ${body.method}`);
  }
});
