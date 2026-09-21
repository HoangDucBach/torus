import Link from "next/link";
import { Button, Card } from "@heroui/react";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-16 px-6 py-16">
      <section className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">Torus Protocol</h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          A yield-bearing USDC vault on Arc — Circle&apos;s L1 where USDC is the native gas
          token — paired with an ERC-4337 paymaster so accounts pay gas straight out of their
          yield. No idle gas balance, no manual swaps, no separate approval step.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/app">
            <Button>Open App</Button>
          </Link>
          <Link href="/stats">
            <Button variant="outline">View Stats</Button>
          </Link>
          <Link href="/developers">
            <Button variant="outline">For Developers</Button>
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card>
          <Card.Header>
            <Card.Title>Deposit &amp; earn</Card.Title>
            <Card.Description>
              Deposit native USDC into torUSDC, an ERC-4626 vault share that accrues yield from a
              pluggable RWA strategy.
            </Card.Description>
          </Card.Header>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>Pay gas from yield</Card.Title>
            <Card.Description>
              TorusPaymaster prices every UserOperation from the vault&apos;s own share rate — no
              external oracle, no separate gas token to hold.
            </Card.Description>
          </Card.Header>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>Open to any protocol</Card.Title>
            <Card.Description>
              The paymaster sponsors gas for any contract call, not just Torus&apos;s own — one
              public ERC-7677 endpoint is the entire integration surface.
            </Card.Description>
          </Card.Header>
        </Card>
      </section>

      <section className="flex flex-col gap-2 text-sm text-zinc-500">
        <p>Live and verified on Arc Testnet (chain 5042002).</p>
        <p>
          See <Link className="underline" href="/developers">Developers</Link> for contract
          addresses and the paymaster endpoint.
        </p>
      </section>
    </main>
  );
}
