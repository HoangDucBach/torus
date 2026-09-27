import Link from "next/link";
import { Card, Tabs } from "@heroui/react";
import { ApiReference } from "@/components/ApiReference";
import { CodeBlock } from "@/components/CodeBlock";
import { ContractAddresses } from "@/components/ContractAddresses";
import { NetworkBadge } from "@/components/NetworkBadge";
import { PaymasterEndpoint } from "@/components/PaymasterEndpoint";

const CODE_SNIPPET = `import { createPaymasterClient } from "viem/account-abstraction";

const paymaster = createPaymasterClient({
  transport: http(TORUS_PAYMASTER_URL),
});`;

export default function DevelopersPage() {
  return (
    <Tabs defaultSelectedKey="sdk" orientation="vertical" variant="secondary">
      <Tabs.ListContainer className="sticky top-0 z-10 bg-background">
        <Tabs.List aria-label="Developers sections">
          <Tabs.Tab id="sdk">
            SDK
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="api">
            <Tabs.Separator />
            API
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>

      <Tabs.Panel id="sdk" className="pt-6">
        <div className="flex flex-col gap-6 pb-6">
          <Card>
            <Card.Header>
              <Card.Title>No SDK required</Card.Title>
              <Card.Description>
                Torus&apos;s paymaster sponsors gas for any contract call, not
                just its own — an account just needs a torUSDC balance. The
                entire integration surface is one public{" "}
                <a
                  className="underline"
                  href="https://eips.ethereum.org/EIPS/eip-7677"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ERC-7677
                </a>{" "}
                paymaster endpoint — any standard ERC-4337 tool already knows
                how to speak it.
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <CodeBlock code={CODE_SNIPPET} lang="typescript" />
              <PaymasterEndpoint />
            </Card.Content>
          </Card>

          <Card>
            <Card.Header className="flex-row items-center justify-between">
              <Card.Title>Contract addresses</Card.Title>
              <NetworkBadge />
            </Card.Header>
            <Card.Content>
              <ContractAddresses />
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Reference implementation</Card.Title>
              <Card.Description>
                A contract with zero knowledge of Torus, called gaslessly via
                EIP-7702 through this same paymaster endpoint.
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-2">
              <Link className="underline" href="/gasless">
                Try the live demo
              </Link>
              <a
                className="text-sm text-foreground/60 underline"
                href="https://github.com/HoangDucBach/torus/tree/feat/torus-protocol/examples/gasless-demo/contracts"
                target="_blank"
                rel="noopener noreferrer"
              >
                examples/gasless-demo/contracts
              </a>
            </Card.Content>
          </Card>
        </div>
      </Tabs.Panel>

      <Tabs.Panel id="api" className="min-h-[85vh] pt-6 pb-6">
        <ApiReference />
      </Tabs.Panel>
    </Tabs>
  );
}
