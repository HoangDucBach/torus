"use client";

import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { Icon } from "@iconify/react";
import { Avatar, Button, Dropdown, Label } from "@heroui/react";
import { useDisconnectWallet, useNetwork } from "@/hooks";
import { NETWORKS, type NetworkId } from "@/lib/networks";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function addressGradient(address: string) {
  const hue1 = (parseInt(address.slice(2, 4), 16) / 255) * 360;
  const hue2 = (parseInt(address.slice(4, 6), 16) / 255) * 360;
  return `linear-gradient(135deg, hsl(${hue1} 70% 55%), hsl(${hue2} 70% 55%))`;
}

const NETWORK_ICON: Record<NetworkId, string> = {
  testnet: "solar:test-tube-bold-duotone",
  mainnet: "solar:global-bold-duotone",
};

function NetworkSwitch() {
  const { networkId, setNetworkId } = useNetwork();

  return (
    <Dropdown>
      <Button variant="tertiary" className="gap-2 rounded-full">
        <Icon icon={NETWORK_ICON[networkId]} className="size-4" />
        {NETWORKS[networkId].label}
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu
          selectionMode="single"
          selectedKeys={[networkId]}
          onAction={(key) => setNetworkId(key as NetworkId)}
        >
          <Dropdown.Item id="testnet" textValue="Testnet">
            <Icon icon={NETWORK_ICON.testnet} className="size-4" />
            <Label>Testnet</Label>
          </Dropdown.Item>
          <Dropdown.Item id="mainnet" textValue="Mainnet">
            <Icon icon={NETWORK_ICON.mainnet} className="size-4" />
            <Label>Mainnet</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const disconnectWallet = useDisconnectWallet();
  const { network } = useNetwork();

  if (pathname === "/") return null;

  return (
    <header className="flex items-center justify-end gap-2 p-4">
      <NetworkSwitch />
      {isConnected && address ? (
        <Dropdown>
          <Button variant="tertiary" className="gap-2 rounded-full pr-4 pl-1">
            <Avatar className="size-7">
              <Avatar.Fallback style={{ background: addressGradient(address) }} />
            </Avatar>
            {shortAddress(address)}
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              onAction={(key) => {
                if (key === "copy") void navigator.clipboard.writeText(address);
                if (key === "explorer") {
                  window.open(`${network.explorerUrl}/address/${address}`, "_blank");
                }
                if (key === "disconnect") disconnectWallet.disconnect();
              }}
            >
              <Dropdown.Item id="copy" textValue="Copy address">
                <Icon icon="solar:copy-bold-duotone" className="size-4" />
                <Label>Copy address</Label>
              </Dropdown.Item>
              <Dropdown.Item id="explorer" textValue="View on explorer">
                <Icon icon="solar:square-top-down-bold-duotone" className="size-4" />
                <Label>View on explorer</Label>
              </Dropdown.Item>
              <Dropdown.Item id="disconnect" textValue="Disconnect" variant="danger">
                <Icon icon="solar:logout-3-bold-duotone" className="size-4" />
                <Label>Disconnect</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      ) : null}
    </header>
  );
}
