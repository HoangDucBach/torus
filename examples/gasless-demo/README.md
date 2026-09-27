# Gasless integration demo

Shows how a **third-party protocol with no relationship to Torus** can let its users pay gas out
of Torus's paymaster instead of holding native USDC.

- [`contracts/`](contracts) — `ExampleCounter.sol`, a trivial contract that has no knowledge of
  Torus at all. Already deployed and verified on Arc Testnet:
  [`0x7d2b774D9cdBB6f3c69AC7be97E633fA911b8e66`](https://explorer.testnet.arc.io/address/0x7d2b774D9cdBB6f3c69AC7be97E633fA911b8e66).
- The demo UI itself lives inside the main dashboard at [`/gasless`](../../web/src/app/gasless)
  (`web/src/app/gasless`) — it calls `ExampleCounter.increment()` from a plain EOA via EIP-7702
  (no smart-account contract deployed), sponsored entirely through Torus's public ERC-7677
  paymaster endpoint (`POST /paymaster` on the main [`server/`](../../server)).

## The integration surface

The only thing that page knows about Torus is one URL:

```ts
const paymaster = createPaymasterClient({ transport: http("<torus-server-url>/paymaster") });
```

Any ERC-4337 tooling that speaks [ERC-7677](https://eips.ethereum.org/EIPS/eip-7677)
(`pm_getPaymasterStubData` / `pm_getPaymasterData`) can point at it — see
[`server/src/routes/paymaster.ts`](../../server/src/routes/paymaster.ts). No SDK, no API key, no
allowlisting: the sending account just needs a `torUSDC` balance, since that's what actually
pays for its gas.

## Running it

```bash
# from repo root
cd server && bun run start   # paymaster endpoint
cd web && bun run dev        # main dashboard, including /gasless
```

Then open `http://localhost:3000/gasless`. You'll need a wallet with some Arc Testnet `torUSDC`
(deposit native USDC into [`TorusVault`](../../contracts/src/TorusVault.sol) via `/app` first)
using the same address Privy's embedded wallet creates for you.

## Redeploying the example contract

```bash
cd contracts
arc-forge build
arc-forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.io --private-key $YOUR_KEY --broadcast
```
