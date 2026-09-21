import { Card, Chip } from "@heroui/react";
import { addresses, serverUrl } from "@/lib/contracts";

const CODE_SNIPPET = `import { createPaymasterClient } from "viem/account-abstraction";

const paymaster = createPaymasterClient({
  transport: http("${serverUrl}/paymaster"),
});`;

function AddressRow({ label, address }: { label: string; address: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <a
        className="break-all font-mono text-sm underline"
        href={`https://explorer.testnet.arc.io/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {address}
      </a>
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <Card.Header>
          <Card.Title>No SDK required</Card.Title>
          <Card.Description>
            Torus&apos;s paymaster sponsors gas for any contract call, not just its own — an
            account just needs a torUSDC balance. The entire integration surface is one public{" "}
            <a
              className="underline"
              href="https://eips.ethereum.org/EIPS/eip-7677"
              target="_blank"
              rel="noopener noreferrer"
            >
              ERC-7677
            </a>{" "}
            paymaster endpoint — any standard ERC-4337 tool already knows how to speak it.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <pre className="overflow-x-auto rounded bg-black/[.06] p-4 text-sm dark:bg-white/[.08]">
            <code>{CODE_SNIPPET}</code>
          </pre>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Contract addresses</Card.Title>
          <Card.Description>Arc Testnet (chain 5042002)</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          <AddressRow label="TorusVault (torUSDC)" address={addresses.vault} />
          <AddressRow label="TorusPaymaster" address={addresses.paymaster} />
          <AddressRow label="USDC" address={addresses.usdc} />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Server API</Card.Title>
          <Card.Description>{serverUrl}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Chip>POST /paymaster</Chip>
            <span>ERC-7677 paymaster RPC — the integration surface above.</span>
          </div>
          <div className="flex items-center gap-3">
            <Chip>GET /stats</Chip>
            <span>Protocol-wide vault and paymaster numbers.</span>
          </div>
          <div className="flex items-center gap-3">
            <Chip>GET /quote</Chip>
            <span>torUSDC required for a given gas amount.</span>
          </div>
          <div className="flex items-center gap-3">
            <Chip>GET /position</Chip>
            <span>Per-address deposit/withdraw cost basis.</span>
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Reference implementation</Card.Title>
          <Card.Description>
            A standalone example — a contract with zero knowledge of Torus, called gaslessly via
            EIP-7702 through this same paymaster endpoint.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <a
            className="underline"
            href="https://github.com/HoangDucBach/torus/tree/feat/torus-protocol/examples/gasless-demo"
            target="_blank"
            rel="noopener noreferrer"
          >
            examples/gasless-demo
          </a>
        </Card.Content>
      </Card>
    </div>
  );
}
