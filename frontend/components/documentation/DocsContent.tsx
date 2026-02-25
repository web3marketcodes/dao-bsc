import { DocsSection, DocsSubSection } from "./DocsSection";
import { DocsCodeBlock } from "./DocsCodeBlock";

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">{children}</p>;
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--card-border)]">
            {headers.map((h) => (
              <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--card-border)]/50">
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-3 text-[var(--muted)]">
                  <code className="text-xs font-mono text-emerald-400">{cell}</code>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc list-inside text-sm text-[var(--muted)] mb-3 space-y-1">{children}</ul>;
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="px-1.5 py-0.5 rounded bg-white/5 text-xs font-mono text-emerald-400">{children}</code>;
}

export function DocsContent() {
  return (
    <div className="flex-1 min-w-0 space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-3 text-white">Documentation</h1>
        <P>
          Complete reference for the OnChain DAO protocol &mdash; a fully autonomous, on-chain governance system
          deployed on BNB Smart Chain. This guide covers smart contracts, deployment, governance workflows,
          tokenomics, and staking.
        </P>
      </div>

      {/* 1. Overview */}
      <DocsSection id="overview" title="Overview">
        <P>
          OnChain DAO is a decentralized autonomous organization built on BNB Smart Chain (BSC). It features a
          two-token economic model and fully on-chain governance where every parameter change must pass through a
          proposal-vote-timelock lifecycle.
        </P>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 my-4 space-y-3">
          <h4 className="font-semibold text-white text-sm">Key Properties</h4>
          <Ul>
            <li><strong className="text-white">Two-token system</strong> &mdash; DAOToken (governance) + TaxToken (revenue)</li>
            <li><strong className="text-white">Fully autonomous</strong> &mdash; deployer renounces all admin roles after setup</li>
            <li><strong className="text-white">On-chain governance</strong> &mdash; proposals, voting, and execution happen entirely on-chain via OpenZeppelin Governor</li>
            <li><strong className="text-white">Revenue sharing</strong> &mdash; TaxToken trading fees are split between stakers, burn, and development</li>
            <li><strong className="text-white">Anti-whale protection</strong> &mdash; configurable max transaction and max wallet limits on TaxToken</li>
          </Ul>
        </div>
        <P>
          The protocol is composed of six smart contracts that interact to provide governance, trading with taxes,
          revenue distribution, and staking rewards.
        </P>
      </DocsSection>

      {/* 2. Architecture */}
      <DocsSection id="architecture" title="Architecture">
        <P>
          The system has two main flows: a governance flow (proposals controlling protocol parameters) and a
          revenue flow (trading taxes distributed to stakeholders).
        </P>
        <DocsCodeBlock title="Governance Flow">
{`DAOToken Holders
      |
      | delegate voting power
      v
DAOGovernor  ──propose──>  Proposal
      |                        |
      | vote (For/Against/     | passes quorum
      |       Abstain)         |
      v                        v
   Voting Period          Queue in DAOTimelock
                               |
                               | 1 hour delay
                               v
                          Execute on-chain
                          (TaxToken / RevenueSplitter / StakingVault)`}
        </DocsCodeBlock>
        <DocsCodeBlock title="Revenue Flow">
{`TaxToken DEX Trade
      |
      | buy/sell tax (5% default)
      v
RevenueSplitter
      |
      |── 50% ──> StakingVault.addRewards()
      |               (distributed to DAOToken stakers)
      |
      |── 20% ──> 0x000...dEaD (burned)
      |
      └── 30% ──> Dev Wallet`}
        </DocsCodeBlock>
        <DocsCodeBlock title="Contract Ownership Map">
{`DAOTimelock (autonomous - no admin)
   ├── owns TaxToken     → setBuyTax, setSellTax, setTradingEnabled, ...
   ├── owns RevenueSplitter → setShares, setDevWallet, ...
   └── owns StakingVault  → setMinLockPeriod`}
        </DocsCodeBlock>
      </DocsSection>

      {/* 3. Smart Contracts */}
      <DocsSection id="smart-contracts" title="Smart Contracts">
        <P>
          All contracts are written in Solidity ^0.8.20 and built on OpenZeppelin v5. They are compiled with the
          Paris EVM target and optimizer enabled at 200 runs.
        </P>

        {/* DAOToken */}
        <DocsSubSection id="contract-daotoken" title="DAOToken">
          <P>
            ERC20 governance token with ERC20Votes and ERC20Permit extensions. Holders must delegate voting
            power (to themselves or another address) before it counts toward proposals and quorum.
          </P>
          <Table
            headers={["Parameter", "Value"]}
            rows={[
              ["Name", "DAOToken"],
              ["Symbol", "DAO"],
              ["Initial Supply", "1,000,000 DAO"],
              ["Decimals", "18"],
              ["Minting", "Constructor only (fixed supply)"],
              ["Inherits", "ERC20, ERC20Permit, ERC20Votes"],
            ]}
          />
          <P>
            No admin functions exist on this contract. The entire supply is minted to the deployer at
            construction and can only change hands via standard ERC20 transfers. Vote checkpoints are
            automatically maintained on every transfer through the <InlineCode>_update</InlineCode> override.
          </P>
        </DocsSubSection>

        {/* DAOTimelock */}
        <DocsSubSection id="contract-timelock" title="DAOTimelock">
          <P>
            Thin wrapper around OpenZeppelin&apos;s TimelockController. Enforces a mandatory delay between a
            proposal passing and its on-chain execution, giving the community time to react.
          </P>
          <Table
            headers={["Parameter", "Value"]}
            rows={[
              ["Min Delay", "3,600 seconds (1 hour)"],
              ["Proposer", "DAOGovernor (set in setup)"],
              ["Executor", "address(0) (anyone can execute)"],
              ["Canceller", "DAOGovernor"],
              ["Admin", "Renounced after setup"],
            ]}
          />
          <P>
            After governance setup, the deployer&apos;s <InlineCode>DEFAULT_ADMIN_ROLE</InlineCode> is
            renounced, making the DAO fully autonomous. No single address can bypass the timelock.
          </P>
        </DocsSubSection>

        {/* DAOGovernor */}
        <DocsSubSection id="contract-governor" title="DAOGovernor">
          <P>
            Core governance contract using OpenZeppelin Governor with counting, quorum fraction, and timelock
            control extensions. Manages the full proposal lifecycle.
          </P>
          <Table
            headers={["Parameter", "Value"]}
            rows={[
              ["Voting Delay", "1 block"],
              ["Voting Period", "300 blocks (~15 min on BSC)"],
              ["Proposal Threshold", "0 (any holder can propose)"],
              ["Quorum", "4% of total supply"],
              ["Vote Types", "0 = Against, 1 = For, 2 = Abstain"],
            ]}
          />
          <P>
            Proposals target functions on contracts owned by the DAOTimelock. When a proposal passes
            quorum, it is queued in the timelock and becomes executable after the 1-hour delay.
          </P>
        </DocsSubSection>

        {/* TaxToken */}
        <DocsSubSection id="contract-taxtoken" title="TaxToken">
          <P>
            ERC20 token with configurable buy/sell taxes on DEX trades, anti-whale limits, and a trading
            toggle. After setup, all parameters are controlled by DAO governance.
          </P>
          <Table
            headers={["Parameter", "Default", "Range"]}
            rows={[
              ["Buy Tax", "500 (5%)", "0 - 2,500 bps (25% max)"],
              ["Sell Tax", "500 (5%)", "0 - 2,500 bps (25% max)"],
              ["Max Transaction", "1% of supply", "Configurable"],
              ["Max Wallet", "2% of supply", "Configurable"],
              ["Trading", "Disabled", "Enabled via governance"],
              ["Tax Recipient", "RevenueSplitter", "Configurable"],
            ]}
          />
          <h4 className="text-sm font-semibold text-white mt-4 mb-2">Governance-Controlled Functions</h4>
          <Table
            headers={["Function", "Description"]}
            rows={[
              ["setBuyTax(uint256)", "Update buy tax (0-2500 bps)"],
              ["setSellTax(uint256)", "Update sell tax (0-2500 bps)"],
              ["setTaxRecipient(address)", "Change where taxes are sent"],
              ["setMaxTransactionAmount(uint256)", "Update per-tx limit"],
              ["setMaxWalletAmount(uint256)", "Update per-wallet limit"],
              ["setTradingEnabled(bool)", "Enable/disable public trading"],
              ["setAmmPair(address, bool)", "Register DEX pair addresses"],
              ["setTaxExempt(address, bool)", "Grant/revoke tax exemption"],
              ["setLimitExempt(address, bool)", "Grant/revoke limit exemption"],
            ]}
          />
        </DocsSubSection>

        {/* RevenueSplitter */}
        <DocsSubSection id="contract-revenuesplitter" title="RevenueSplitter">
          <P>
            Receives TaxToken proceeds from trades and distributes them across three streams. The
            <InlineCode>distribute()</InlineCode> function is permissionless &mdash; anyone can trigger it.
          </P>
          <Table
            headers={["Stream", "Default Share", "Destination"]}
            rows={[
              ["Staking Rewards", "50%", "StakingVault.addRewards()"],
              ["Burn", "20%", "0x000...dEaD"],
              ["Development", "30%", "Dev wallet"],
            ]}
          />
          <h4 className="text-sm font-semibold text-white mt-4 mb-2">Governance-Controlled Functions</h4>
          <Table
            headers={["Function", "Description"]}
            rows={[
              ["setShares(uint256, uint256, uint256)", "Update staking/burn/dev split (sum <= 10000 bps)"],
              ["setDevWallet(address)", "Change dev wallet address"],
              ["setStakingVault(address)", "Change staking vault address"],
            ]}
          />
        </DocsSubSection>

        {/* StakingVault */}
        <DocsSubSection id="contract-stakingvault" title="StakingVault">
          <P>
            Allows DAOToken holders to stake and earn TaxToken rewards. Uses the Synthetix
            <InlineCode>rewardPerToken</InlineCode> accumulator pattern for gas-efficient pro-rata
            distribution.
          </P>
          <Table
            headers={["Parameter", "Value"]}
            rows={[
              ["Staking Token", "DAOToken"],
              ["Reward Token", "TaxToken"],
              ["Min Lock Period", "7 days (default)"],
              ["Reward Model", "Synthetix rewardPerToken accumulator"],
            ]}
          />
          <Table
            headers={["Function", "Description"]}
            rows={[
              ["stake(uint256)", "Deposit DAOTokens into the vault"],
              ["withdraw(uint256)", "Withdraw after lock period expires"],
              ["claimRewards()", "Claim accrued TaxToken rewards"],
              ["addRewards(uint256)", "Called by RevenueSplitter to fund rewards"],
              ["setMinLockPeriod(uint256)", "Governance-controlled lock duration"],
            ]}
          />
        </DocsSubSection>
      </DocsSection>

      {/* 4. Deployment Guide */}
      <DocsSection id="deployment-guide" title="Deployment Guide">
        <h3 className="text-lg font-semibold mb-3 text-white">Prerequisites</h3>
        <Ul>
          <li>Node.js v18+ and npm</li>
          <li>A funded deployer wallet (BNB for gas)</li>
          <li>BscScan API key (for contract verification)</li>
        </Ul>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">1. Install Dependencies</h3>
        <DocsCodeBlock title="Terminal">
{`npm install`}
        </DocsCodeBlock>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">2. Configure Environment</h3>
        <P>Copy the example env file and fill in your values:</P>
        <DocsCodeBlock title=".env">
{`PRIVATE_KEY=your_deployer_private_key
BSCSCAN_API_KEY=your_bscscan_api_key`}
        </DocsCodeBlock>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">3. Compile Contracts</h3>
        <DocsCodeBlock title="Terminal">
{`npx hardhat compile`}
        </DocsCodeBlock>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">4. Deploy Contracts</h3>
        <P>
          The deploy script deploys all six contracts in dependency order and configures initial
          TaxToken exemptions.
        </P>
        <DocsCodeBlock title="Terminal">
{`npx hardhat run scripts/deploy.ts --network bscTestnet`}
        </DocsCodeBlock>
        <P>
          The script outputs contract addresses as environment variables. Copy them into your
          <InlineCode>.env</InlineCode> file:
        </P>
        <DocsCodeBlock title="Deploy output">
{`DAO_TOKEN_ADDRESS=0x...
DAO_TIMELOCK_ADDRESS=0x...
DAO_GOVERNOR_ADDRESS=0x...
TAX_TOKEN_ADDRESS=0x...
STAKING_VAULT_ADDRESS=0x...
REVENUE_SPLITTER_ADDRESS=0x...`}
        </DocsCodeBlock>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">5. Setup Governance</h3>
        <P>
          This script grants timelock roles to the Governor, transfers contract ownership to the
          Timelock, and renounces the deployer&apos;s admin role. <strong className="text-white">This is
          irreversible</strong> &mdash; after this step, all parameter changes require a governance proposal.
        </P>
        <DocsCodeBlock title="Terminal">
{`npx hardhat run scripts/setup-governance.ts --network bscTestnet`}
        </DocsCodeBlock>
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 my-4">
          <p className="text-sm text-yellow-400">
            <strong>Warning:</strong> The setup-governance script renounces the deployer&apos;s admin role. Ensure all
            initial configuration is correct before running this step.
          </p>
        </div>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">6. Verify Contracts</h3>
        <DocsCodeBlock title="Terminal">
{`npx hardhat verify --network bscTestnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>`}
        </DocsCodeBlock>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Deployment Order Summary</h3>
        <Table
          headers={["Step", "Contract", "Dependencies"]}
          rows={[
            ["1", "DAOToken", "None"],
            ["2", "DAOTimelock", "None"],
            ["3", "DAOGovernor", "DAOToken, DAOTimelock"],
            ["4", "TaxToken", "None"],
            ["5", "StakingVault", "DAOToken, TaxToken"],
            ["6", "RevenueSplitter", "TaxToken, StakingVault"],
          ]}
        />
      </DocsSection>

      {/* 5. Frontend Setup */}
      <DocsSection id="frontend-setup" title="Frontend Setup">
        <P>
          The frontend is a Next.js 15 app with React 19, Tailwind CSS v4, wagmi v2 for wallet
          interactions, and Reown AppKit for the wallet connection modal.
        </P>

        <h3 className="text-lg font-semibold mb-3 text-white">1. Get a Reown Project ID</h3>
        <P>
          Sign up at <InlineCode>cloud.reown.com</InlineCode> and create a project to get your
          Project ID.
        </P>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">2. Configure Environment</h3>
        <DocsCodeBlock title="frontend/.env.local">
{`NEXT_PUBLIC_REOWN_PROJECT_ID=your_project_id

NEXT_PUBLIC_DAO_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_DAO_TIMELOCK_ADDRESS=0x...
NEXT_PUBLIC_DAO_GOVERNOR_ADDRESS=0x...
NEXT_PUBLIC_TAX_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_REVENUE_SPLITTER_ADDRESS=0x...
NEXT_PUBLIC_STAKING_VAULT_ADDRESS=0x...`}
        </DocsCodeBlock>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">3. Install and Run</h3>
        <DocsCodeBlock title="Terminal">
{`cd frontend
npm install
npm run dev`}
        </DocsCodeBlock>
        <P>
          The dev server starts at <InlineCode>http://localhost:3000</InlineCode>. The app connects to
          BSC Testnet by default.
        </P>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">4. Production Build</h3>
        <DocsCodeBlock title="Terminal">
{`npm run build
npm run start`}
        </DocsCodeBlock>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Tech Stack</h3>
        <Table
          headers={["Technology", "Version", "Purpose"]}
          rows={[
            ["Next.js", "15", "React framework (App Router)"],
            ["React", "19", "UI library"],
            ["Tailwind CSS", "4", "Utility-first styling"],
            ["wagmi", "2", "React hooks for Ethereum"],
            ["viem", "2", "Low-level Ethereum client"],
            ["Reown AppKit", "1.6", "Wallet connection modal"],
            ["TanStack Query", "5", "Async data fetching/caching"],
          ]}
        />
      </DocsSection>

      {/* 6. Governance Guide */}
      <DocsSection id="governance-guide" title="Governance Guide">
        <P>
          Governance follows the standard OpenZeppelin Governor lifecycle. Any DAOToken holder with
          delegated voting power can participate.
        </P>

        <h3 className="text-lg font-semibold mb-3 text-white">Step 1: Delegate Voting Power</h3>
        <P>
          Before you can vote or propose, you must delegate your voting power. You can delegate to
          yourself or to another address. Go to the <InlineCode>/delegate</InlineCode> page in the app.
        </P>
        <DocsCodeBlock>
{`// Self-delegate to activate your own voting power
DAOToken.delegate(yourAddress)`}
        </DocsCodeBlock>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Step 2: Create a Proposal</h3>
        <P>
          Navigate to <InlineCode>/proposals/create</InlineCode>. A proposal specifies one or more
          on-chain actions (target contract, function call, and parameters) plus a description.
        </P>
        <P>
          The proposal threshold is currently 0, so any token holder with delegated power can propose.
        </P>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Step 3: Vote</h3>
        <P>
          After the 1-block voting delay, the proposal enters the Active state for 300 blocks
          (~15 minutes on BSC). Token holders can vote For, Against, or Abstain. Voting power is
          based on your delegated balance at the block the proposal was created.
        </P>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Step 4: Queue</h3>
        <P>
          If the proposal passes (more For than Against votes, and at least 4% quorum), it moves to
          the Succeeded state. Anyone can then queue it in the DAOTimelock, which starts the 1-hour
          delay.
        </P>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Step 5: Execute</h3>
        <P>
          After the timelock delay elapses, anyone can execute the proposal. The on-chain actions are
          carried out through the Timelock contract.
        </P>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Proposal Lifecycle</h3>
        <Table
          headers={["State", "Description"]}
          rows={[
            ["Pending", "Created, waiting for voting delay"],
            ["Active", "Voting is open"],
            ["Defeated", "Did not reach quorum or more Against votes"],
            ["Succeeded", "Passed, ready to queue"],
            ["Queued", "In timelock, waiting for delay"],
            ["Executed", "Actions performed on-chain"],
            ["Canceled", "Canceled by the proposer or Governor"],
            ["Expired", "Queued but not executed before grace period"],
          ]}
        />
      </DocsSection>

      {/* 7. Tokenomics */}
      <DocsSection id="tokenomics" title="Tokenomics">
        <P>
          The protocol uses a two-token model: DAOToken for governance and staking, and TaxToken
          for revenue generation through trading taxes.
        </P>

        <h3 className="text-lg font-semibold mb-3 text-white">DAOToken (DAO)</h3>
        <Table
          headers={["Property", "Value"]}
          rows={[
            ["Type", "ERC20 + Votes + Permit"],
            ["Total Supply", "1,000,000 DAO (fixed)"],
            ["Minting", "Disabled (constructor-only mint)"],
            ["Use Cases", "Governance voting, staking for rewards"],
          ]}
        />

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">TaxToken (TAX)</h3>
        <Table
          headers={["Property", "Value"]}
          rows={[
            ["Type", "ERC20 + Ownable"],
            ["Total Supply", "1,000,000 TAX (fixed)"],
            ["Buy Tax", "5% (configurable, max 25%)"],
            ["Sell Tax", "5% (configurable, max 25%)"],
            ["Max Transaction", "1% of supply"],
            ["Max Wallet", "2% of supply"],
          ]}
        />

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Revenue Distribution</h3>
        <P>
          Taxes collected from TaxToken DEX trades are sent to the RevenueSplitter contract, which
          distributes them across three streams:
        </P>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4">
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-center">
            <p className="text-2xl font-bold text-white">50%</p>
            <p className="text-xs text-[var(--muted)] mt-1">Staking Rewards</p>
          </div>
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-center">
            <p className="text-2xl font-bold text-white">20%</p>
            <p className="text-xs text-[var(--muted)] mt-1">Burned (Deflationary)</p>
          </div>
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-center">
            <p className="text-2xl font-bold text-white">30%</p>
            <p className="text-xs text-[var(--muted)] mt-1">Development</p>
          </div>
        </div>
        <P>
          All tax rates and revenue splits are governance-controlled. The DAO can vote to adjust these
          parameters at any time through proposals.
        </P>
      </DocsSection>

      {/* 8. Staking */}
      <DocsSection id="staking" title="Staking">
        <P>
          DAOToken holders can stake their tokens in the StakingVault to earn TaxToken rewards from
          trading fees. Rewards are distributed proportionally to each staker&apos;s share of the total
          staked pool.
        </P>

        <h3 className="text-lg font-semibold mb-3 text-white">How to Stake</h3>
        <Ul>
          <li>Navigate to the <InlineCode>/staking</InlineCode> page</li>
          <li>Enter the amount of DAOTokens to stake</li>
          <li>Approve the StakingVault to spend your DAOTokens (first time only)</li>
          <li>Confirm the stake transaction</li>
        </Ul>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Lock Period</h3>
        <P>
          Staked tokens are subject to a minimum lock period of <strong className="text-white">7 days</strong> (default).
          You cannot withdraw before this period expires. The lock resets each time you add more stake.
          The lock period is governance-controlled and can be adjusted via proposal.
        </P>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Rewards</h3>
        <P>
          Rewards accumulate continuously as trading fees flow through the RevenueSplitter. The
          StakingVault uses a <InlineCode>rewardPerToken</InlineCode> accumulator (Synthetix pattern)
          to efficiently calculate each staker&apos;s pro-rata share without iterating over all stakers.
        </P>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Claiming Rewards</h3>
        <Ul>
          <li>View your pending rewards on the <InlineCode>/staking</InlineCode> page</li>
          <li>Click &quot;Claim Rewards&quot; to receive your accrued TaxToken rewards</li>
          <li>Claiming does not affect your staked balance or lock period</li>
        </Ul>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Withdrawing</h3>
        <Ul>
          <li>After the lock period expires, enter the amount to withdraw</li>
          <li>Any unclaimed rewards are automatically claimed on withdrawal</li>
          <li>Partial withdrawals are supported</li>
        </Ul>

        <h3 className="text-lg font-semibold mb-3 text-white mt-6">Staking Parameters</h3>
        <Table
          headers={["Parameter", "Value", "Controlled By"]}
          rows={[
            ["Staking Token", "DAOToken", "Immutable"],
            ["Reward Token", "TaxToken", "Immutable"],
            ["Min Lock Period", "7 days", "Governance"],
            ["Reward Source", "50% of trading taxes", "Governance (RevenueSplitter shares)"],
          ]}
        />
      </DocsSection>
    </div>
  );
}
