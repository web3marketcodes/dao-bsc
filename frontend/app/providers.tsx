"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { type State, WagmiProvider } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { bscTestnet, bsc } from "@reown/appkit/networks";
import { wagmiAdapter, projectId } from "@/lib/wagmi-config";

// Initialize AppKit
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [bscTestnet, bsc],
  defaultNetwork: bscTestnet,
  metadata: {
    name: "OnChain DAO",
    description: "Decentralized Autonomous Organization on BSC",
    url: "https://onchain-dao.example.com",
    icons: ["/icon.png"],
  },
  features: {
    analytics: false,
  },
});

export function Providers({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: State;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
