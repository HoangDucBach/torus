import { Hono } from "hono";
import { numberToHex } from "viem";
import { addresses } from "../contracts.ts";

/**
 * ERC-7677 (`pm_*`) paymaster RPC. Any AA SDK that speaks this standard (viem's
 * `paymasterActions`, permissionless.js's `createPaymasterClient`, etc.) can point at this
 * single endpoint and use Torus as a paymaster with zero Torus-specific integration code.
 *
 * Torus needs neither a signature scheme nor per-request state: {TorusPaymaster-_fetchDetails}
 * prices every operation purely from the vault's own exchange rate, so `paymasterData` is
 * always empty and the two ERC-7677 methods return practically the same payload — the only
 * difference upstream is *when* each is called (stub data during gas estimation, final data
 * once the account has settled its gas limits).
 */
export const paymasterRoute = new Hono();

// Conservative, fixed estimates for the paymaster's own validation/postOp gas usage. postOp
// does one ERC-20 transferFrom-equivalent (a torUSDC balance write); 60_000 comfortably covers
// it plus the unused-gas-penalty margin described in {PaymasterERC20-_postOpGasPenalty}.
const PAYMASTER_VERIFICATION_GAS_LIMIT = 150_000n;
const PAYMASTER_POST_OP_GAS_LIMIT = 60_000n;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number | string | null;
  method: string;
  params?: unknown[];
};

function paymasterStubResult() {
  return {
    paymaster: addresses.paymaster,
    paymasterData: "0x" as const,
    paymasterVerificationGasLimit: numberToHex(PAYMASTER_VERIFICATION_GAS_LIMIT),
    paymasterPostOpGasLimit: numberToHex(PAYMASTER_POST_OP_GAS_LIMIT),
    isFinal: true,
  };
}

function paymasterDataResult() {
  return {
    paymaster: addresses.paymaster,
    paymasterData: "0x" as const,
  };
}

paymasterRoute.post("/", async (c) => {
  const body = (await c.req.json()) as JsonRpcRequest;

  const respond = (result: unknown) => c.json({ jsonrpc: "2.0", id: body.id, result });
  const respondError = (code: number, message: string) =>
    c.json({ jsonrpc: "2.0", id: body.id, error: { code, message } }, 200);

  switch (body.method) {
    case "pm_getPaymasterStubData":
      return respond(paymasterStubResult());
    case "pm_getPaymasterData":
      return respond(paymasterDataResult());
    default:
      return respondError(-32601, `Method not found: ${body.method}`);
  }
});
