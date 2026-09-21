# Torus Protocol

Autonomous liquidity middleware for [Arc](https://www.arc.io/), Circle's Layer-1 network where
**USDC is the native gas token**. Torus issues `torUSDC`, a value-accruing ERC-4626 vault share,
and pairs it with an ERC-4337 paymaster so smart accounts can pay gas directly out of their
yield — no idle gas balance, no manual swaps, no separate approval step.

Status: **deployed and verified on Arc Testnet** (chain `5042002`). Mainnet (`5042`) is the
eventual target; see [Deploying](#deploying).

## Live on Arc Testnet

| Contract | Address |
|---|---|
| `TorusVault` (torUSDC) | [`0xF87e393cdC523E69dE27e2E992225136d654273b`](https://explorer.testnet.arc.io/address/0xF87e393cdC523E69dE27e2E992225136d654273b) |
| `TorusPaymaster` | [`0x497B7b6aAcB8a3372D569740c92ED53F75ED670B`](https://explorer.testnet.arc.io/address/0x497B7b6aAcB8a3372D569740c92ED53F75ED670B) |
| `MockRWAStrategy` | [`0x575bFa3763153075327E32eAf00C9292560A4C72`](https://explorer.testnet.arc.io/address/0x575bFa3763153075327E32eAf00C9292560A4C72) |
| `MockRWAOracle` | [`0x408009125c85E10242372dFa0dB9364b37092159`](https://explorer.testnet.arc.io/address/0x408009125c85E10242372dFa0dB9364b37092159) |

All four are verified (source visible on the explorer). Live proof of the core claim — a smart
account with **zero native USDC** paying gas entirely out of its `torUSDC` balance, through the
real, already-deployed Arc EntryPoint v0.7, with no bundler-as-a-service involved (submitted
directly to `handleOps`):
[`0xa37737ff3b4e2ffa48e2532aeac11cabb1c806fe9299826539fafa3472bde363`](https://explorer.testnet.arc.io/tx/0xa37737ff3b4e2ffa48e2532aeac11cabb1c806fe9299826539fafa3472bde363).

## How it works

```
User's smart account
   │  depositNative{value}(receiver)          (no wrap step: see "Decimal model" below)
   ▼
TorusVault (ERC-4626, torUSDC)  ───invest───▶  IYieldStrategy (MockRWAStrategy for now)
   │  ▲                                              │
   │  └──────────── harvest() skims 10% perf fee ────┘ (accrue() on the strategy first)
   │
   │  torUSDC.allowance(user, paymaster) == max        (implicit, no approve tx needed)
   ▼
TorusPaymaster (ERC-4337 v0.7)  ──validatePaymasterUserOp / postOp──▶  EntryPoint v0.7
   │  prices gas purely from vault.previewDeposit() — no oracle, no AMM
   ▼
refuel(): redeem collected torUSDC → native USDC → top up EntryPoint deposit
```

## Repository layout

```
contracts/    Arc Foundry project — TorusVault, TorusPaymaster, mocks, tests, deploy scripts
server/       Bun + Hono service — ERC-7677 paymaster RPC, /quote, /stats, keeper cron, e2e script
```

## Contracts (`contracts/`)

| File | Purpose |
|---|---|
| [`src/TorusVault.sol`](contracts/src/TorusVault.sol) | ERC-4626 vault (`torUSDC`) built on OpenZeppelin v5.7.0. `depositNative`, pluggable `IYieldStrategy`, permissionless `harvest()`, implicit max-allowance for the configured `gasSpender`. |
| [`src/TorusPaymaster.sol`](contracts/src/TorusPaymaster.sol) | Extends OZ's `PaymasterERC20` (ERC-4337 v0.7). Prices gas from `vault.previewDeposit()` plus a configurable spread; `refuel()` closes the self-sustaining gas loop. |
| [`src/strategies/MockRWAOracle.sol`](contracts/src/strategies/MockRWAOracle.sol) / [`MockRWAStrategy.sol`](contracts/src/strategies/MockRWAStrategy.sol) | PoC yield source standing in for a real RWA venue (e.g. a future `USYCStrategy` on Circle's USYC). Yield is always backed 1:1 by a pre-funded reserve of real USDC. |
| [`src/interfaces/`](contracts/src/interfaces) | `ITorusVault`, `IYieldStrategy` — the extension points for a future strategy or a different vault frontend. |
| [`script/Deploy.s.sol`](contracts/script/Deploy.s.sol) / [`Setup.s.sol`](contracts/script/Setup.s.sol) | Deploy the stack and write `deployments/<chainId>.json`; stake + fund the paymaster's EntryPoint deposit. |
| [`test/`](contracts/test) | Unit tests (mocked USDC), a stateful invariant suite, and an integration test **forked from live Arc Testnet** exercising the real EntryPoint v0.7 and USDC precompile. |

Contracts are intentionally immutable (no proxies) — parameters (fee, spread, strategy,
treasury) are adjustable via `AccessControl`/`Ownable2Step`, keeping the audit surface small for
a protocol that will eventually manage mainnet value.

### Why no "WUSDC"

The original design assumed a wrapped-native token, but Arc's native USDC and its ERC-20
interface **are the same underlying balance** — confirmed on-chain (`docs.arc.io/arc/references/evm-differences`
and directly, e.g. `eth_getBalance / erc20.balanceOf == 1e12` for any account). `depositNative`
therefore just accounts for `msg.value` (already credited to the vault's ERC-20 `balanceOf` by
the time the function body runs); no wrap/unwrap call exists anywhere in the protocol.

### Decimal model

| | Decimals |
|---|---|
| Arc native USDC (`address(this).balance`, `msg.value`) | 18 |
| USDC ERC-20 interface (`0x3600…0000`, the vault's `asset()`) | 6 |
| `torUSDC` (vault shares) | 18 (6 + a 12-decimal `_decimalsOffset`, which also raises the cost of the classic ERC-4626 inflation attack) |

`NATIVE_SCALE = 1e12` converts between the native and ERC-20 views everywhere it's needed.

### Running the tests

```bash
cd contracts
arc-forge install OpenZeppelin/openzeppelin-contracts@v5.7.0 foundry-rs/forge-std  # first time only

FOUNDRY_PROFILE=arc arc-forge test --no-match-contract FullLifecycleTest   # unit + invariants, fast, offline
FOUNDRY_PROFILE=arc arc-forge test --match-contract FullLifecycleTest     # integration, forks live Arc Testnet
```

34 unit/invariant tests + 2 integration tests (one of which submits a real, signed
`UserOperation` through the actual Arc Testnet EntryPoint and asserts the smart account never
needed a wei of native gas) all pass as of this writing.

### Deploying

```bash
cd contracts
export PRIVATE_KEY=0x...            # deployer / initial admin
export ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.io

arc-forge script script/Deploy.s.sol --rpc-url $ARC_TESTNET_RPC_URL --broadcast \
  --verifier blockscout --verifier-url https://explorer.testnet.arc.io/api/

arc-forge script script/Setup.s.sol --rpc-url $ARC_TESTNET_RPC_URL --broadcast \
  --sig "run()" # stakes + funds the paymaster's EntryPoint deposit
```

`Deploy.s.sol` writes addresses to `deployments/<chainId>.json`, which `server/` reads
automatically. The same scripts work unchanged on mainnet (`ARC_MAINNET_RPC_URL`,
`--verifier-url https://explorer.arc.io/api/`) — Arc mainnet and testnet share the same USDC and
EntryPoint addresses.

## Server (`server/`)

Bun + [Hono](https://hono.dev), chosen for minimal footprint — no framework beyond routing is
needed since all state lives on-chain.

| Route | Purpose |
|---|---|
| `POST /paymaster` | [ERC-7677](https://eips.ethereum.org/EIPS/eip-7677) `pm_getPaymasterStubData` / `pm_getPaymasterData`. Any AA SDK that speaks this standard (viem, permissionless.js, …) can use Torus as a paymaster with **zero Torus-specific client code**. |
| `GET /quote` | Estimated `torUSDC` cost for a given `gas`/`maxFeePerGas`, computed with the same formula as the on-chain paymaster. |
| `GET /stats` | TVL, exchange rate, fee/spread config, strategy reserve, paymaster EntryPoint deposit. |

```bash
cd server
bun install
cp .env.example .env   # fill in ARC_NETWORK / DEPLOYMENT_FILE / KEEPER_PRIVATE_KEY

bun run start     # the API (paymaster + /quote + /stats)
bun run keeper     # accrue → harvest → refuel loop, on KEEPER_INTERVAL_SECONDS
bun run e2e        # full flow via a real bundler (needs BUNDLER_RPC_URL, see scripts/e2e.ts)
```

## Security notes

- **No external price oracle in the gas-payment path.** `TorusPaymaster` prices every operation
  from `TorusVault`'s own share/asset ratio — eliminating the flash-loan/oracle-manipulation
  surface a typical ERC-20 paymaster carries.
- **Unstaked-paymaster restriction (ERC-7562).** `PaymasterERC20._prefund` writes to `torUSDC`
  storage during validation; `Setup.s.sol` stakes the paymaster so public-mempool bundlers
  accept it.
- **Implicit max allowance.** `TorusVault.allowance(user, gasSpender)` returns `type(uint256).max`
  for the one configured `gasSpender` address (the paymaster). This never touches storage (OZ's
  `_spendAllowance` treats `type(uint256).max` as infinite and skips the write) and the paymaster
  can only ever pull funds via the EntryPoint on behalf of a `UserOperation` the account itself
  signed.
- **Yield is always over-collateralized in real USDC.** `MockRWAStrategy.accrue()` caps
  simulated yield at the actual USDC reserve funded ahead of time, so `totalAssets()` can never
  exceed real, redeemable balances.
- Not yet audited. Treat contract addresses in `deployments/*.json` as testnet-only until an
  external review has run against a pinned commit.

## What's out of scope for this PR

- `USYCStrategy` (a real RWA yield source via Circle's USYC Teller) — `MockRWAStrategy`
  implements the same `IYieldStrategy` interface so it's a drop-in replacement once USYC
  entitlement/allowlisting is in place.
- Mainnet deployment and ownership handoff to a multisig/timelock.
- A third-party security audit.
