"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";
import { createPublicClient, http } from "viem";
import { Alert, Button, Card, Chip } from "@heroui/react";
import { counterAbi } from "@/lib/contracts";
import { useGaslessIncrement, useNetwork } from "@/hooks";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function GaslessPage() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const increment = useGaslessIncrement();
  const { network } = useNetwork();
  const [count, setCount] = useState<bigint>();

  const hasPrivy = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

  const readCount = async () => {
    const client = createPublicClient({ chain: network.chain, transport: http() });
    setCount(
      await client.readContract({
        address: network.addresses.counter,
        abi: counterAbi,
        functionName: "count",
      })
    );
  };

  if (!hasPrivy) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Not configured</Alert.Title>
          <Alert.Description>
            Set NEXT_PUBLIC_PRIVY_APP_ID (and NEXT_PUBLIC_BUNDLER_URL) in .env.local.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <Card.Header>
          <Card.Title>1. Wallet</Card.Title>
          <Card.Description>
            Standard browser wallets can&apos;t sign an EIP-7702 authorization yet, so this uses a
            Privy embedded wallet instead.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {!ready ? (
            <p className="text-foreground/60">Loading...</p>
          ) : !authenticated ? (
            <Button onPress={() => login()}>Log in with Privy</Button>
          ) : (
            <div className="flex items-center gap-3">
              <Chip>{user?.wallet?.address ? shortAddress(user.wallet.address) : "Embedded wallet"}</Chip>
              <Button variant="outline" onPress={() => logout()}>
                Log out
              </Button>
            </div>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>2. Send a sponsored call</Card.Title>
          <Card.Description>
            <code className="rounded bg-foreground/10 px-1 py-0.5 text-sm">ExampleCounter</code> is
            an ordinary contract that has never heard of Torus — gas for this call is paid
            entirely through Torus&apos;s public paymaster endpoint.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <Button
            isDisabled={!authenticated}
            isPending={increment.isPending}
            onPress={() => increment.mutate()}
          >
            Call increment() gaslessly
          </Button>
          {increment.isSuccess ? (
            <Alert status="accent">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Confirmed</Alert.Title>
                <Alert.Description className="break-all">
                  Tx: {increment.data.txHash}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          {increment.error ? (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Failed</Alert.Title>
                <Alert.Description>{increment.error.message}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>3. Read the result</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          <Button variant="outline" className="w-fit" onPress={() => readCount()}>
            Refresh count()
          </Button>
          {count !== undefined ? <p>count() = {count.toString()}</p> : null}
          <a
            className="text-sm text-foreground/60 underline"
            href={`${network.explorerUrl}/address/${network.addresses.counter}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View ExampleCounter on the explorer
          </a>
        </Card.Content>
      </Card>
    </div>
  );
}
