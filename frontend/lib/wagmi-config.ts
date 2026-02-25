import { cookieStorage, createStorage } from "wagmi";
import { bscTestnet, bsc } from "wagmi/chains";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { http } from "viem";

// Get your project ID from https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "";

export const networks = [bscTestnet, bsc];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }) as any,
  ssr: true,
  projectId,
  networks,
  transports: {
    [bscTestnet.id]: http("https://rpc.ankr.com/bsc_testnet_chapel/8a030b9797dc6653cde1a6d371bd4c0dfa80e1affef7b1e12a487aa58c38dd46"),
    [bsc.id]: http("https://bsc-dataseed.binance.org/"),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
