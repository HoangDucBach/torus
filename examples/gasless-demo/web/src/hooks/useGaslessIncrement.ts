"use client";

import { useCreateWallet, useSign7702Authorization, useWallets } from "@privy-io/react-auth";
import { to7702SimpleSmartAccount } from "permissionless/accounts";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { createPublicClient, encodeFunctionData, http, type Hash } from "viem";
import { createBundlerClient, createPaymasterClient } from "viem/account-abstraction";
import { arcTestnet } from "@/lib/chain";
import { counterAbi, counterAddress, torusServerUrl } from "@/lib/contracts";

// eth-infinitism's Simple7702Account reference implementation, already deployed on Arc at this
// canonical address — same one permissionless.js's 7702 helpers default to.
const SIMPLE_7702_ACCOUNT_IMPL = "0xe6Cae83BdE06E4c305530e199D7217f42808555B" as const;

type GaslessIncrementResult = {
  userOpHash: Hash;
  txHash: Hash;
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The whole point of this example: ExampleCounter is a completely unrelated third-party
 * contract — it has no idea Torus exists. This hook proves that ANY contract call from ANY
 * EOA (via EIP-7702, no separate smart-account deployment) can be sponsored purely by pointing
 * a standard ERC-4337 bundler client at Torus's `/paymaster` endpoint (ERC-7677). That endpoint
 * is the entire integration surface — nothing else from Torus is required.
 */
export function useGaslessIncrement() {
  const { signAuthorization } = useSign7702Authorization();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();

  const walletsRef = useRef(wallets);
  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  return useMutation({
    mutationFn: async (): Promise<GaslessIncrementResult> => {
      const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL;
      if (!bundlerUrl) {
        throw new Error("Set NEXT_PUBLIC_BUNDLER_URL to a bundler that supports Arc Testnet (e.g. Pimlico)");
      }

      const findEmbeddedWallet = () => walletsRef.current.find((w) => w.walletClientType === "privy");

      let embeddedWallet = findEmbeddedWallet();
      if (!embeddedWallet) {
        await createWallet();
        for (let attempt = 0; !embeddedWallet && attempt < 20; attempt++) {
          await sleep(250);
          embeddedWallet = findEmbeddedWallet();
        }
      }
      if (!embeddedWallet) {
        throw new Error("Could not find or create a Privy embedded wallet — try again");
      }

      const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
      const provider = await embeddedWallet.getEthereumProvider();

      const account = await to7702SimpleSmartAccount({
        client: publicClient,
        owner: { request: provider.request.bind(provider) },
      });

      const authorization = await signAuthorization(
        {
          contractAddress: SIMPLE_7702_ACCOUNT_IMPL,
          chainId: arcTestnet.id,
          nonce: await publicClient.getTransactionCount({ address: account.address }),
        },
        { address: embeddedWallet.address }
      );

      const paymaster = createPaymasterClient({ transport: http(`${torusServerUrl}/paymaster`) });
      const bundlerClient = createBundlerClient({
        client: publicClient,
        chain: arcTestnet,
        transport: http(bundlerUrl),
        paymaster,
      });

      const userOpHash = await bundlerClient.sendUserOperation({
        account,
        calls: [
          {
            to: counterAddress,
            value: 0n,
            data: encodeFunctionData({ abi: counterAbi, functionName: "increment" }),
          },
        ],
        authorization,
      });

      const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
      return { userOpHash, txHash: receipt.receipt.transactionHash };
    },
  });
}
