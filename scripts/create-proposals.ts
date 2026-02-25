import { ethers } from "hardhat";
import "dotenv/config";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Creating proposals with:", deployer.address);

  // Load contracts
  const token = await ethers.getContractAt("DAOToken", process.env.DAO_TOKEN_ADDRESS!);
  const governor = await ethers.getContractAt("DAOGovernor", process.env.DAO_GOVERNOR_ADDRESS!);
  const taxTokenAddress = process.env.TAX_TOKEN_ADDRESS!;
  const revenueSplitterAddress = process.env.REVENUE_SPLITTER_ADDRESS!;
  const stakingVaultAddress = process.env.STAKING_VAULT_ADDRESS!;

  // ─── Step 1: Delegate tokens to self (activates voting power) ─────
  console.log("\n1. Delegating DAO tokens to self...");
  let tx = await token.delegate(deployer.address);
  await tx.wait();
  const votes = await token.getVotes(deployer.address);
  console.log("   Voting power:", ethers.formatEther(votes), "DAO");

  // Wait a block so the checkpoint is recorded
  console.log("   Waiting for checkpoint block...");
  tx = await deployer.sendTransaction({ to: deployer.address, value: 0 });
  await tx.wait();

  // ─── Step 2: Create proposals ─────────────────────────────────────
  const taxTokenIface = new ethers.Interface([
    "function setBuyTax(uint256 _buyTax)",
    "function setSellTax(uint256 _sellTax)",
    "function setMaxTransactionAmount(uint256 _maxTransactionAmount)",
    "function setTradingEnabled(bool _enabled)",
  ]);
  const revenueSplitterIface = new ethers.Interface([
    "function setShares(uint256 _stakingShare, uint256 _burnShare, uint256 _devShare)",
  ]);
  const stakingVaultIface = new ethers.Interface([
    "function setMinLockPeriod(uint256 _period)",
  ]);

  // Proposal 1: Reduce buy tax from 5% to 3%
  console.log("\n2. Creating Proposal #1: Reduce buy tax to 3%...");
  const prop1Tx = await governor.propose(
    [taxTokenAddress],
    [0],
    [taxTokenIface.encodeFunctionData("setBuyTax", [300])],
    "# Reduce Buy Tax to 3%\n\nThis proposal reduces the buy tax from the current 5% (500 bps) to 3% (300 bps).\n\n**Rationale:** A lower buy tax will encourage more trading volume and attract new holders. The current 5% tax is a barrier to entry for new investors.\n\n**Impact:** Revenue from buy transactions will decrease by 40%, but increased volume should offset this."
  );
  const prop1Receipt = await prop1Tx.wait();
  const prop1Event = prop1Receipt!.logs.find((l: any) => {
    try { return governor.interface.parseLog({ topics: l.topics as string[], data: l.data })?.name === "ProposalCreated"; } catch { return false; }
  });
  const prop1Id = governor.interface.parseLog({ topics: prop1Event!.topics as string[], data: prop1Event!.data })!.args.proposalId;
  console.log("   Proposal #1 ID:", prop1Id.toString());

  // Proposal 2: Update revenue split to 60/15/25
  console.log("\n3. Creating Proposal #2: Update revenue split...");
  const prop2Tx = await governor.propose(
    [revenueSplitterAddress],
    [0],
    [revenueSplitterIface.encodeFunctionData("setShares", [6000, 1500, 2500])],
    "# Update Revenue Split to 60/15/25\n\nThis proposal changes the revenue distribution from the current 50/20/30 to:\n- **60%** to Staking Rewards (up from 50%)\n- **15%** to Burn (down from 20%)\n- **25%** to Dev Wallet (down from 30%)\n\n**Rationale:** Increasing staking rewards incentivizes long-term holding and strengthens governance participation. The dev team has agreed to a reduced share to prioritize community growth."
  );
  const prop2Receipt = await prop2Tx.wait();
  const prop2Event = prop2Receipt!.logs.find((l: any) => {
    try { return governor.interface.parseLog({ topics: l.topics as string[], data: l.data })?.name === "ProposalCreated"; } catch { return false; }
  });
  const prop2Id = governor.interface.parseLog({ topics: prop2Event!.topics as string[], data: prop2Event!.data })!.args.proposalId;
  console.log("   Proposal #2 ID:", prop2Id.toString());

  // Proposal 3: Reduce staking lock period from 7 days to 3 days
  console.log("\n4. Creating Proposal #3: Reduce staking lock period...");
  const prop3Tx = await governor.propose(
    [stakingVaultAddress],
    [0],
    [stakingVaultIface.encodeFunctionData("setMinLockPeriod", [3 * 24 * 60 * 60])], // 3 days
    "# Reduce Staking Lock Period to 3 Days\n\nThis proposal reduces the minimum staking lock period from 7 days to 3 days.\n\n**Rationale:** The current 7-day lock period discourages participation from smaller holders who need more flexibility. A 3-day lock still prevents reward gaming while improving accessibility.\n\n**Risk:** Slightly increased risk of flash-loan style reward extraction, but the 3-day minimum is sufficient protection."
  );
  const prop3Receipt = await prop3Tx.wait();
  const prop3Event = prop3Receipt!.logs.find((l: any) => {
    try { return governor.interface.parseLog({ topics: l.topics as string[], data: l.data })?.name === "ProposalCreated"; } catch { return false; }
  });
  const prop3Id = governor.interface.parseLog({ topics: prop3Event!.topics as string[], data: prop3Event!.data })!.args.proposalId;
  console.log("   Proposal #3 ID:", prop3Id.toString());

  // Proposal 4: Enable trading on TaxToken
  console.log("\n5. Creating Proposal #4: Enable TaxToken trading...");
  const prop4Tx = await governor.propose(
    [taxTokenAddress],
    [0],
    [taxTokenIface.encodeFunctionData("setTradingEnabled", [true])],
    "# Enable TaxToken Trading\n\nThis proposal enables public trading of the TAX token.\n\n**Rationale:** The TAX token is currently non-tradable outside of exempt addresses. Enabling trading will allow the token to be listed on DEXs and establish a market price.\n\n**Prerequisites:** Liquidity should be added to PancakeSwap before execution. The AMM pair address must be registered via a separate proposal."
  );
  const prop4Receipt = await prop4Tx.wait();
  const prop4Event = prop4Receipt!.logs.find((l: any) => {
    try { return governor.interface.parseLog({ topics: l.topics as string[], data: l.data })?.name === "ProposalCreated"; } catch { return false; }
  });
  const prop4Id = governor.interface.parseLog({ topics: prop4Event!.topics as string[], data: prop4Event!.data })!.args.proposalId;
  console.log("   Proposal #4 ID:", prop4Id.toString());

  // ─── Step 3: Wait for voting delay (1 block) ─────────────────────
  console.log("\n6. Waiting for voting delay (1 block)...");
  // Send a dummy tx to mine a block on testnet
  tx = await deployer.sendTransaction({ to: deployer.address, value: 0 });
  await tx.wait();
  // Wait a bit for the next block
  console.log("   Waiting for next block...");
  await new Promise((r) => setTimeout(r, 5000));

  // ─── Step 4: Cast votes ───────────────────────────────────────────
  // VoteType: 0 = Against, 1 = For, 2 = Abstain
  console.log("\n7. Casting votes...");

  console.log("   Voting FOR Proposal #1 (Reduce buy tax)...");
  tx = await governor.castVote(prop1Id, 1); // For
  await tx.wait();

  console.log("   Voting FOR Proposal #2 (Update revenue split)...");
  tx = await governor.castVote(prop2Id, 1); // For
  await tx.wait();

  console.log("   Voting AGAINST Proposal #3 (Reduce lock period)...");
  tx = await governor.castVote(prop3Id, 0); // Against
  await tx.wait();

  console.log("   Voting FOR Proposal #4 (Enable trading)...");
  tx = await governor.castVote(prop4Id, 1); // For
  await tx.wait();

  // ─── Summary ──────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("All proposals created and votes cast!");
  console.log("═══════════════════════════════════════════");
  console.log("Proposal #1: Reduce Buy Tax to 3%       → Voted FOR");
  console.log("Proposal #2: Update Revenue Split        → Voted FOR");
  console.log("Proposal #3: Reduce Lock Period to 3d    → Voted AGAINST");
  console.log("Proposal #4: Enable TaxToken Trading     → Voted FOR");
  console.log("═══════════════════════════════════════════");
  console.log("\nAll proposals are now in ACTIVE state (voting open for ~300 blocks / ~15 minutes).");
  console.log("Check the frontend at http://localhost:3000/proposals to see them!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
