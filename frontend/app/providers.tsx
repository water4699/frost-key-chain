"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import "@rainbow-me/rainbowkit/styles.css";
import { InMemoryStorageProvider } from "@/hooks/useInMemoryStorage";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { hardhat, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MetaMaskProvider } from "@/hooks/metamask/useMetaMaskProvider";
import { MetaMaskEthersSignerProvider } from "@/hooks/metamask/useMetaMaskEthersSigner";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  const [queryClient] = useState(() => new QueryClient());

  // Build readonly RPC map for FHEVM usage (avoid routing reads via wallet)
  const localUrl = process.env.NEXT_PUBLIC_LOCAL_RPC_URL || "http://127.0.0.1:8545";
  // Prefer public Sepolia RPC that typically works in more regions.
  // Can be overridden via NEXT_PUBLIC_SEPOLIA_RPC_URL.
  const sepoliaUrl =
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "https://rpc.sepolia.org";

  // Wagmi + RainbowKit
  // Important: Provide transports for the full union of possible chain ids
  // even if Sepolia is not included in `chains`, to satisfy Wagmi's typing.
  const transports = {
    [hardhat.id]: http(localUrl),
    [sepolia.id]: http(sepoliaUrl),
  } as const;

  // Always include Sepolia in chain list so RainbowKit modal shows both
  const chains = [hardhat, sepolia] as const;

  const wagmiConfig = createConfig({
    chains,
    connectors: [injected()],
    transports,
    ssr: true,
  });

  // Build initialMockChains for MetaMaskEthersSignerProvider
  const initialMockChains = {
    [hardhat.id]: localUrl,
  } as const;

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <MetaMaskProvider>
            <MetaMaskEthersSignerProvider initialMockChains={initialMockChains}>
              <InMemoryStorageProvider>{children}</InMemoryStorageProvider>
            </MetaMaskEthersSignerProvider>
          </MetaMaskProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
