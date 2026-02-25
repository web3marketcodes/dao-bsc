import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  // ─── 1. Deploy DAOToken ────────────────────────────────────────────
  const tokenFactory = await ethers.getContractFactory("DAOToken");
  const token = await tokenFactory.deploy("DAOToken", "DAO", 1_000_000);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("DAOToken deployed to:", tokenAddress);

  // ─── 2. Deploy DAOTimelock ─────────────────────────────────────────
  const TIMELOCK_DELAY = 3600; // 1 hour
  const timelockFactory = await ethers.getContractFactory("DAOTimelock");
  const timelock = await timelockFactory.deploy(
    TIMELOCK_DELAY,
    [],             // proposers (set in setup script)
    [],             // executors (set in setup script)
    deployer.address // admin (renounced in setup script)
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("DAOTimelock deployed to:", timelockAddress);

  // ─── 3. Deploy DAOGovernor ─────────────────────────────────────────
  const VOTING_DELAY = 1;         // 1 block
  const VOTING_PERIOD = 300;      // ~15 minutes on BSC (3s blocks)
  const PROPOSAL_THRESHOLD = 0;   // anyone with tokens can propose
  const QUORUM_PERCENTAGE = 4;    // 4% of total supply

  const governorFactory = await ethers.getContractFactory("DAOGovernor");
  const governor = await governorFactory.deploy(
    tokenAddress,
    timelockAddress,
    VOTING_DELAY,
    VOTING_PERIOD,
    PROPOSAL_THRESHOLD,
    QUORUM_PERCENTAGE
  );
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  console.log("DAOGovernor deployed to:", governorAddress);

  // ─── 4. Deploy TaxToken ───────────────────────────────────────────
  const taxTokenFactory = await ethers.getContractFactory("TaxToken");
  const taxToken = await taxTokenFactory.deploy("TaxToken", "TAX", 1_000_000, deployer.address);
  await taxToken.waitForDeployment();
  const taxTokenAddress = await taxToken.getAddress();
  console.log("TaxToken deployed to:", taxTokenAddress);

  // ─── 5. Deploy StakingVault ───────────────────────────────────────
  const stakingVaultFactory = await ethers.getContractFactory("StakingVault");
  const stakingVault = await stakingVaultFactory.deploy(
    tokenAddress,
    taxTokenAddress,
    deployer.address
  );
  await stakingVault.waitForDeployment();
  const stakingVaultAddress = await stakingVault.getAddress();
  console.log("StakingVault deployed to:", stakingVaultAddress);

  // ─── 6. Deploy RevenueSplitter ────────────────────────────────────
  const revenueSplitterFactory = await ethers.getContractFactory("RevenueSplitter");
  const revenueSplitter = await revenueSplitterFactory.deploy(
    taxTokenAddress,
    stakingVaultAddress,
    deployer.address, // devWallet = deployer initially
    deployer.address  // owner
  );
  await revenueSplitter.waitForDeployment();
  const revenueSplitterAddress = await revenueSplitter.getAddress();
  console.log("RevenueSplitter deployed to:", revenueSplitterAddress);

  // ─── 7. Configure TaxToken ────────────────────────────────────────
  console.log("\nConfiguring TaxToken...");
  let tx = await taxToken.setTaxRecipient(revenueSplitterAddress);
  await tx.wait();
  console.log("  TaxRecipient set to RevenueSplitter");

  // Mark RevenueSplitter as tax-exempt and limit-exempt
  tx = await taxToken.setTaxExempt(revenueSplitterAddress, true);
  await tx.wait();
  tx = await taxToken.setLimitExempt(revenueSplitterAddress, true);
  await tx.wait();
  console.log("  RevenueSplitter marked as tax-exempt + limit-exempt");

  // Mark StakingVault as tax-exempt and limit-exempt
  tx = await taxToken.setTaxExempt(stakingVaultAddress, true);
  await tx.wait();
  tx = await taxToken.setLimitExempt(stakingVaultAddress, true);
  await tx.wait();
  console.log("  StakingVault marked as tax-exempt + limit-exempt");

  // ─── Summary ───────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("Deployment complete! Contract addresses:");
  console.log("═══════════════════════════════════════════");
  console.log(`DAO_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`DAO_TIMELOCK_ADDRESS=${timelockAddress}`);
  console.log(`DAO_GOVERNOR_ADDRESS=${governorAddress}`);
  console.log(`TAX_TOKEN_ADDRESS=${taxTokenAddress}`);
  console.log(`STAKING_VAULT_ADDRESS=${stakingVaultAddress}`);
  console.log(`REVENUE_SPLITTER_ADDRESS=${revenueSplitterAddress}`);
  console.log("═══════════════════════════════════════════");
  console.log("\nNext step: Run setup-governance script to configure roles.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
