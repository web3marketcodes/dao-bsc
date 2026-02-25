import abis from "./abis.json";

// ─── Deployed Contract Addresses ──────────────────────────────────────
// Update these after deploying to BSC Testnet/Mainnet
export const CONTRACT_ADDRESSES = {
  daoToken: (process.env.NEXT_PUBLIC_DAO_TOKEN_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  daoTimelock: (process.env.NEXT_PUBLIC_DAO_TIMELOCK_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  daoGovernor: (process.env.NEXT_PUBLIC_DAO_GOVERNOR_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  taxToken: (process.env.NEXT_PUBLIC_TAX_TOKEN_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  revenueSplitter: (process.env.NEXT_PUBLIC_REVENUE_SPLITTER_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  stakingVault: (process.env.NEXT_PUBLIC_STAKING_VAULT_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;

// ─── Deployment block (used to limit event log queries) ───────────────
export const DEPLOYMENT_BLOCK = 92408600n;

// ─── Chunked log fetcher with in-memory cache ───────────────────────
const logCache = new Map<string, { data: any[]; lastBlock: bigint; timestamp: number }>();
const CACHE_TTL = 60_000; // 60 seconds

export async function getLogsInChunks(
  client: { getLogs: (args: any) => Promise<any[]>; getBlockNumber: () => Promise<bigint> },
  params: { address: `0x${string}`; event: any; fromBlock: bigint },
  chunkSize = 499n
) {
  const cacheKey = `${params.address}-${(params.event as any).name}`;
  const cached = logCache.get(cacheKey);
  const latestBlock = await client.getBlockNumber();

  // Return cache if fresh
  if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.lastBlock === latestBlock) {
    return cached.data;
  }

  // Start from where cached data left off, or from deployment block
  const startBlock = cached ? cached.lastBlock + 1n : params.fromBlock;
  const newLogs: any[] = [];

  for (let from = startBlock; from <= latestBlock; from += chunkSize + 1n) {
    const to = from + chunkSize > latestBlock ? latestBlock : from + chunkSize;
    const logs = await client.getLogs({
      ...params,
      fromBlock: from,
      toBlock: to,
    });
    newLogs.push(...logs);
  }

  const allLogs = cached ? [...cached.data, ...newLogs] : newLogs;
  logCache.set(cacheKey, { data: allLogs, lastBlock: latestBlock, timestamp: Date.now() });

  return allLogs;
}

// ─── ABIs ─────────────────────────────────────────────────────────────
export const DAOTokenABI = abis.DAOToken as readonly Record<string, unknown>[];
export const DAOGovernorABI = abis.DAOGovernor as readonly Record<string, unknown>[];
export const DAOTimelockABI = abis.DAOTimelock as readonly Record<string, unknown>[];
export const TaxTokenABI = abis.TaxToken as readonly Record<string, unknown>[];
export const RevenueSplitterABI = abis.RevenueSplitter as readonly Record<string, unknown>[];
export const StakingVaultABI = abis.StakingVault as readonly Record<string, unknown>[];

// ─── Proposal States ──────────────────────────────────────────────────
export const PROPOSAL_STATES = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Queued",
  "Expired",
  "Executed",
] as const;

export const PROPOSAL_STATE_COLORS: Record<string, string> = {
  Pending: "bg-yellow-500/20 text-yellow-400",
  Active: "bg-blue-500/20 text-blue-400",
  Canceled: "bg-gray-500/20 text-gray-400",
  Defeated: "bg-red-500/20 text-red-400",
  Succeeded: "bg-green-500/20 text-green-400",
  Queued: "bg-purple-500/20 text-purple-400",
  Expired: "bg-gray-500/20 text-gray-400",
  Executed: "bg-emerald-500/20 text-emerald-400",
};
