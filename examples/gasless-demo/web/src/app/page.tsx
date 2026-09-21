"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";
import { createPublicClient, http } from "viem";
import { arcTestnet } from "@/lib/chain";
import { counterAbi, counterAddress } from "@/lib/contracts";
import { useGaslessIncrement } from "@/hooks/useGaslessIncrement";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Home() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const increment = useGaslessIncrement();
  const [count, setCount] = useState<bigint>();

  const readCount = async () => {
    const client = createPublicClient({ chain: arcTestnet, transport: http() });
    setCount(await client.readContract({ address: counterAddress, abi: counterAbi, functionName: "count" }));
  };

  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Gasless integration demo</h1>
        <p className="text-zinc-600">
          <code className="rounded bg-black/[.06] px-1 py-0.5 text-sm">ExampleCounter</code> is an
          ordinary contract that has never heard of Torus. This app calls its{" "}
          <code className="rounded bg-black/[.06] px-1 py-0.5 text-sm">increment()</code> from a
          plain EOA — via EIP-7702, no smart-account contract ever deployed — with gas paid
          entirely through Torus&apos;s public paymaster endpoint. That endpoint is the only thing
          this app knows about Torus.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-black/10 p-4">
        <h2 className="font-medium">1. Wallet</h2>
        {!ready ? (
          <p>Loading...</p>
        ) : !authenticated ? (
          <button
            type="button"
            className="w-fit rounded bg-black px-4 py-2 text-white"
            onClick={() => login()}
          >
            Log in with Privy
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-black/[.06] px-3 py-1 text-sm">
              {user?.wallet?.address ? shortAddress(user.wallet.address) : "Embedded wallet"}
            </span>
            <button type="button" className="text-sm underline" onClick={() => logout()}>
              Log out
            </button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-black/10 p-4">
        <h2 className="font-medium">2. Send a sponsored call</h2>
        <button
          type="button"
          className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-40"
          disabled={!authenticated || increment.isPending}
          onClick={() => increment.mutate()}
        >
          {increment.isPending ? "Sending..." : "Call increment() gaslessly"}
        </button>
        {increment.isSuccess ? (
          <p className="text-sm text-green-700 break-all">
            Confirmed. Tx:{" "}
            <a
              className="underline"
              href={`https://explorer.testnet.arc.io/tx/${increment.data.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {increment.data.txHash}
            </a>
          </p>
        ) : null}
        {increment.error ? (
          <p className="text-sm text-red-700">{increment.error.message}</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-black/10 p-4">
        <h2 className="font-medium">3. Read the result</h2>
        <button
          type="button"
          className="w-fit rounded border border-black/20 px-4 py-2"
          onClick={() => readCount()}
        >
          Refresh count()
        </button>
        {count !== undefined ? <p>count() = {count.toString()}</p> : null}
        <a
          className="text-sm underline"
          href={`https://explorer.testnet.arc.io/address/${counterAddress}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View ExampleCounter on the explorer
        </a>
      </section>
    </main>
  );
}
