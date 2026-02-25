import { ethers } from "hardhat";
import "dotenv/config";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting up governance with:", deployer.address);

  // ─── Load deployed addresses from env ──────────────────────────────
  const governorAddress = process.env.DAO_GOVERNOR_ADDRESS;
  const timelockAddress = process.env.DAO_TIMELOCK_ADDRESS;
  const taxTokenAddress = process.env.TAX_TOKEN_ADDRESS;
  const revenueSplitterAddress = process.env.REVENUE_SPLITTER_ADDRESS;
  const stakingVaultAddress = process.env.STAKING_VAULT_ADDRESS;

  if (!governorAddress || !timelockAddress || !taxTokenAddress || !revenueSplitterAddress || !stakingVaultAddress) {
    throw new Error(
      "Missing contract addresses. Set DAO_GOVERNOR_ADDRESS, DAO_TIMELOCK_ADDRESS, TAX_TOKEN_ADDRESS, REVENUE_SPLITTER_ADDRESS, and STAKING_VAULT_ADDRESS in .env"
    );
  }

  const timelock = await ethers.getContractAt("DAOTimelock", timelockAddress);
  const taxToken = await ethers.getContractAt("TaxToken", taxTokenAddress);
  const revenueSplitter = await ethers.getContractAt("RevenueSplitter", revenueSplitterAddress);
  const stakingVault = await ethers.getContractAt("StakingVault", stakingVaultAddress);

  // ─── 1. Grant roles on Timelock ────────────────────────────────────
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
  const ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

  console.log("Granting PROPOSER_ROLE to Governor...");
  let tx = await timelock.grantRole(PROPOSER_ROLE, governorAddress);
  await tx.wait();

  console.log("Granting CANCELLER_ROLE to Governor...");
  tx = await timelock.grantRole(CANCELLER_ROLE, governorAddress);
  await tx.wait();

  console.log("Granting EXECUTOR_ROLE to address(0) (open execution)...");
  tx = await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress);
  await tx.wait();

  // ─── 2. Set Timelock as tax-exempt and limit-exempt (before ownership transfer) ─
  console.log("Setting Timelock as tax-exempt + limit-exempt on TaxToken...");
  tx = await taxToken.setTaxExempt(timelockAddress, true);
  await tx.wait();
  tx = await taxToken.setLimitExempt(timelockAddress, true);
  await tx.wait();
  console.log("  Timelock marked as tax-exempt + limit-exempt");

  // ─── 3. Transfer ownership of all contracts to Timelock ────────────
  console.log("Transferring TaxToken ownership to Timelock...");
  tx = await taxToken.transferOwnership(timelockAddress);
  await tx.wait();
  console.log("TaxToken owner is now:", await taxToken.owner());

  console.log("Transferring RevenueSplitter ownership to Timelock...");
  tx = await revenueSplitter.transferOwnership(timelockAddress);
  await tx.wait();
  console.log("RevenueSplitter owner is now:", await revenueSplitter.owner());

  console.log("Transferring StakingVault ownership to Timelock...");
  tx = await stakingVault.transferOwnership(timelockAddress);
  await tx.wait();
  console.log("StakingVault owner is now:", await stakingVault.owner());

  // ─── 4. Renounce deployer admin role (IRREVERSIBLE) ────────────────
  console.log("Renouncing DEFAULT_ADMIN_ROLE from deployer (irreversible)...");
  tx = await timelock.renounceRole(ADMIN_ROLE, deployer.address);
  await tx.wait();

  // ─── Done ──────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("Governance setup complete!");
  console.log("═══════════════════════════════════════════");
  console.log("- Governor has PROPOSER + CANCELLER roles on Timelock");
  console.log("- Anyone can execute (EXECUTOR_ROLE = address(0))");
  console.log("- TaxToken is owned by Timelock");
  console.log("- RevenueSplitter is owned by Timelock");
  console.log("- StakingVault is owned by Timelock");
  console.log("- Deployer admin role renounced — DAO is fully autonomous");
  console.log("═══════════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
