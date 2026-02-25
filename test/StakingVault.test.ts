import { expect } from "chai";
import { ethers } from "hardhat";
import { DAOToken, TaxToken, StakingVault } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { increaseTime } from "./helpers";

describe("StakingVault", function () {
  let daoToken: DAOToken;
  let taxToken: TaxToken;
  let vault: StakingVault;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;

  const DAO_SUPPLY = 1_000_000n;
  const TAX_SUPPLY = 1_000_000n;
  const SEVEN_DAYS = 7 * 24 * 60 * 60;

  beforeEach(async function () {
    [deployer, alice, bob, charlie] = await ethers.getSigners();

    // Deploy DAOToken
    const daoFactory = await ethers.getContractFactory("DAOToken");
    daoToken = await daoFactory.deploy("DAOToken", "DAO", DAO_SUPPLY);

    // Deploy TaxToken
    const taxFactory = await ethers.getContractFactory("TaxToken");
    taxToken = await taxFactory.deploy("TaxToken", "TAX", TAX_SUPPLY, deployer.address);

    // Deploy StakingVault
    const vaultFactory = await ethers.getContractFactory("StakingVault");
    vault = await vaultFactory.deploy(
      await daoToken.getAddress(),
      await taxToken.getAddress(),
      deployer.address
    );

    // Transfer some DAO tokens to alice and bob for staking
    await daoToken.transfer(alice.address, ethers.parseEther("100000"));
    await daoToken.transfer(bob.address, ethers.parseEther("100000"));
    await daoToken.transfer(charlie.address, ethers.parseEther("100000"));

    // Approve vault for all users
    await daoToken.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256);
    await daoToken.connect(bob).approve(await vault.getAddress(), ethers.MaxUint256);
    await daoToken.connect(charlie).approve(await vault.getAddress(), ethers.MaxUint256);

    // Make TaxToken exempt for deployer and vault
    await taxToken.setTaxExempt(deployer.address, true);
    await taxToken.setLimitExempt(deployer.address, true);
    await taxToken.setTaxExempt(await vault.getAddress(), true);
    await taxToken.setLimitExempt(await vault.getAddress(), true);

    // Enable trading so vault can transfer TaxTokens
    await taxToken.setTradingEnabled(true);
  });

  // --- Staking ----

  describe("Staking", function () {
    it("should allow staking DAOTokens", async function () {
      const stakeAmount = ethers.parseEther("10000");
      await vault.connect(alice).stake(stakeAmount);

      expect(await vault.stakedBalance(alice.address)).to.equal(stakeAmount);
      expect(await vault.totalStaked()).to.equal(stakeAmount);
    });

    it("should emit Staked event", async function () {
      const stakeAmount = ethers.parseEther("5000");
      await expect(vault.connect(alice).stake(stakeAmount))
        .to.emit(vault, "Staked")
        .withArgs(alice.address, stakeAmount);
    });

    it("should update stake timestamp", async function () {
      await vault.connect(alice).stake(ethers.parseEther("1000"));
      expect(await vault.stakeTimestamp(alice.address)).to.be.gt(0n);
    });

    it("should revert staking 0", async function () {
      await expect(vault.connect(alice).stake(0)).to.be.revertedWith(
        "StakingVault: cannot stake 0"
      );
    });

    it("should track totalStaked across multiple stakers", async function () {
      await vault.connect(alice).stake(ethers.parseEther("5000"));
      await vault.connect(bob).stake(ethers.parseEther("3000"));
      expect(await vault.totalStaked()).to.equal(ethers.parseEther("8000"));
    });
  });

  // --- Withdrawal ----

  describe("Withdrawal", function () {
    const stakeAmount = ethers.parseEther("10000");

    beforeEach(async function () {
      await vault.connect(alice).stake(stakeAmount);
    });

    it("should allow withdrawal after lock period", async function () {
      await increaseTime(SEVEN_DAYS + 1);

      const balBefore = await daoToken.balanceOf(alice.address);
      await vault.connect(alice).withdraw(stakeAmount);
      const balAfter = await daoToken.balanceOf(alice.address);

      expect(balAfter - balBefore).to.equal(stakeAmount);
      expect(await vault.stakedBalance(alice.address)).to.equal(0n);
      expect(await vault.totalStaked()).to.equal(0n);
    });

    it("should emit Withdrawn event", async function () {
      await increaseTime(SEVEN_DAYS + 1);
      await expect(vault.connect(alice).withdraw(stakeAmount))
        .to.emit(vault, "Withdrawn")
        .withArgs(alice.address, stakeAmount);
    });

    it("should revert withdrawal before lock period", async function () {
      await expect(
        vault.connect(alice).withdraw(stakeAmount)
      ).to.be.revertedWith("StakingVault: lock period not elapsed");
    });

    it("should revert withdrawal of more than staked", async function () {
      await increaseTime(SEVEN_DAYS + 1);
      await expect(
        vault.connect(alice).withdraw(stakeAmount + 1n)
      ).to.be.revertedWith("StakingVault: insufficient balance");
    });

    it("should revert withdrawing 0", async function () {
      await increaseTime(SEVEN_DAYS + 1);
      await expect(vault.connect(alice).withdraw(0)).to.be.revertedWith(
        "StakingVault: cannot withdraw 0"
      );
    });

    it("should allow partial withdrawal", async function () {
      await increaseTime(SEVEN_DAYS + 1);

      const partialAmount = ethers.parseEther("4000");
      await vault.connect(alice).withdraw(partialAmount);

      expect(await vault.stakedBalance(alice.address)).to.equal(stakeAmount - partialAmount);
      expect(await vault.totalStaked()).to.equal(stakeAmount - partialAmount);
    });

    it("should allow withdraw then claim remaining rewards", async function () {
      // Add rewards while alice is staking
      const rewardAmount = ethers.parseEther("1000");
      await taxToken.approve(await vault.getAddress(), rewardAmount);
      await vault.addRewards(rewardAmount);

      await increaseTime(SEVEN_DAYS + 1);

      // Withdraw all
      await vault.connect(alice).withdraw(stakeAmount);

      // Alice should still have earned rewards
      const earned = await vault.earned(alice.address);
      expect(earned).to.equal(rewardAmount);

      // Claim rewards
      await vault.connect(alice).claimRewards();
      expect(await vault.earned(alice.address)).to.equal(0n);
    });
  });

  // --- Re-staking ----

  describe("Re-staking", function () {
    it("should reset lock timer on re-stake after withdrawal", async function () {
      await vault.connect(alice).stake(ethers.parseEther("5000"));
      await increaseTime(SEVEN_DAYS + 1);
      await vault.connect(alice).withdraw(ethers.parseEther("5000"));

      // Re-stake
      await vault.connect(alice).stake(ethers.parseEther("3000"));

      // Cannot withdraw immediately — lock timer reset
      await expect(
        vault.connect(alice).withdraw(ethers.parseEther("3000"))
      ).to.be.revertedWith("StakingVault: lock period not elapsed");

      // Wait for lock period again
      await increaseTime(SEVEN_DAYS + 1);
      await expect(
        vault.connect(alice).withdraw(ethers.parseEther("3000"))
      ).to.not.be.reverted;
    });
  });

  // --- Synthetix Reward Math ----

  describe("Reward Math", function () {
    it("should distribute rewards proportionally to a single staker", async function () {
      const stakeAmount = ethers.parseEther("10000");
      await vault.connect(alice).stake(stakeAmount);

      const rewardAmount = ethers.parseEther("1000");
      await taxToken.approve(await vault.getAddress(), rewardAmount);
      await vault.addRewards(rewardAmount);

      expect(await vault.earned(alice.address)).to.equal(rewardAmount);
    });

    it("should distribute rewards proportionally to multiple stakers", async function () {
      await vault.connect(alice).stake(ethers.parseEther("75000"));
      await vault.connect(bob).stake(ethers.parseEther("25000"));

      const rewardAmount = ethers.parseEther("1000");
      await taxToken.approve(await vault.getAddress(), rewardAmount);
      await vault.addRewards(rewardAmount);

      const aliceEarned = await vault.earned(alice.address);
      const bobEarned = await vault.earned(bob.address);

      expect(aliceEarned).to.equal(ethers.parseEther("750"));
      expect(bobEarned).to.equal(ethers.parseEther("250"));
    });

    it("should not give late joiner prior rewards", async function () {
      await vault.connect(alice).stake(ethers.parseEther("10000"));

      const reward1 = ethers.parseEther("500");
      await taxToken.approve(await vault.getAddress(), reward1);
      await vault.addRewards(reward1);

      await vault.connect(bob).stake(ethers.parseEther("10000"));

      expect(await vault.earned(bob.address)).to.equal(0n);
      expect(await vault.earned(alice.address)).to.equal(reward1);
    });

    it("should accumulate rewards across multiple distributions", async function () {
      await vault.connect(alice).stake(ethers.parseEther("10000"));

      const reward1 = ethers.parseEther("200");
      await taxToken.approve(await vault.getAddress(), reward1);
      await vault.addRewards(reward1);

      const reward2 = ethers.parseEther("300");
      await taxToken.approve(await vault.getAddress(), reward2);
      await vault.addRewards(reward2);

      expect(await vault.earned(alice.address)).to.equal(
        ethers.parseEther("500")
      );
    });

    it("should handle multiple reward distributions with changing staker set", async function () {
      // Alice stakes alone
      await vault.connect(alice).stake(ethers.parseEther("10000"));

      // First reward: 100 tokens — all to Alice
      const reward1 = ethers.parseEther("100");
      await taxToken.approve(await vault.getAddress(), reward1);
      await vault.addRewards(reward1);

      // Bob joins (equal stake)
      await vault.connect(bob).stake(ethers.parseEther("10000"));

      // Second reward: 200 tokens — split 50/50
      const reward2 = ethers.parseEther("200");
      await taxToken.approve(await vault.getAddress(), reward2);
      await vault.addRewards(reward2);

      // Alice: 100 + 100 = 200, Bob: 0 + 100 = 100
      expect(await vault.earned(alice.address)).to.equal(ethers.parseEther("200"));
      expect(await vault.earned(bob.address)).to.equal(ethers.parseEther("100"));
    });
  });

  // --- Claim Rewards ----

  describe("Claim Rewards", function () {
    it("should transfer earned rewards to user", async function () {
      await vault.connect(alice).stake(ethers.parseEther("10000"));

      const rewardAmount = ethers.parseEther("1000");
      await taxToken.approve(await vault.getAddress(), rewardAmount);
      await vault.addRewards(rewardAmount);

      const taxBalBefore = await taxToken.balanceOf(alice.address);
      await vault.connect(alice).claimRewards();
      const taxBalAfter = await taxToken.balanceOf(alice.address);

      expect(taxBalAfter - taxBalBefore).to.equal(rewardAmount);
    });

    it("should reset rewards to 0 after claim", async function () {
      await vault.connect(alice).stake(ethers.parseEther("10000"));

      const rewardAmount = ethers.parseEther("1000");
      await taxToken.approve(await vault.getAddress(), rewardAmount);
      await vault.addRewards(rewardAmount);

      await vault.connect(alice).claimRewards();
      expect(await vault.earned(alice.address)).to.equal(0n);
    });

    it("should emit RewardsClaimed event", async function () {
      await vault.connect(alice).stake(ethers.parseEther("10000"));

      const rewardAmount = ethers.parseEther("1000");
      await taxToken.approve(await vault.getAddress(), rewardAmount);
      await vault.addRewards(rewardAmount);

      await expect(vault.connect(alice).claimRewards())
        .to.emit(vault, "RewardsClaimed")
        .withArgs(alice.address, rewardAmount);
    });

    it("should revert if no rewards to claim", async function () {
      await vault.connect(alice).stake(ethers.parseEther("10000"));
      await expect(vault.connect(alice).claimRewards()).to.be.revertedWith(
        "StakingVault: no rewards to claim"
      );
    });

    it("should allow claim after full withdrawal (earned rewards persist)", async function () {
      await vault.connect(alice).stake(ethers.parseEther("10000"));

      const rewardAmount = ethers.parseEther("500");
      await taxToken.approve(await vault.getAddress(), rewardAmount);
      await vault.addRewards(rewardAmount);

      // Withdraw all
      await increaseTime(SEVEN_DAYS + 1);
      await vault.connect(alice).withdraw(ethers.parseEther("10000"));

      // Rewards should still be claimable
      expect(await vault.earned(alice.address)).to.equal(rewardAmount);

      const taxBalBefore = await taxToken.balanceOf(alice.address);
      await vault.connect(alice).claimRewards();
      const taxBalAfter = await taxToken.balanceOf(alice.address);
      expect(taxBalAfter - taxBalBefore).to.equal(rewardAmount);
    });
  });

  // --- AddRewards ----

  describe("AddRewards", function () {
    it("should update rewardPerTokenStored", async function () {
      await vault.connect(alice).stake(ethers.parseEther("10000"));

      const rewardAmount = ethers.parseEther("1000");
      await taxToken.approve(await vault.getAddress(), rewardAmount);
      await vault.addRewards(rewardAmount);

      expect(await vault.rewardPerTokenStored()).to.equal(
        ethers.parseEther("0.1")
      );
    });

    it("should emit RewardsAdded event", async function () {
      await vault.connect(alice).stake(ethers.parseEther("10000"));

      const rewardAmount = ethers.parseEther("1000");
      await taxToken.approve(await vault.getAddress(), rewardAmount);

      const expectedRPT = ethers.parseEther("0.1");
      await expect(vault.addRewards(rewardAmount))
        .to.emit(vault, "RewardsAdded")
        .withArgs(rewardAmount, expectedRPT);
    });

    it("should revert adding 0 rewards", async function () {
      await expect(vault.addRewards(0)).to.be.revertedWith(
        "StakingVault: cannot add 0 rewards"
      );
    });

    it("should handle rewards when no stakers (no revert, but RPT unchanged)", async function () {
      const rewardAmount = ethers.parseEther("1000");
      await taxToken.approve(await vault.getAddress(), rewardAmount);
      await vault.addRewards(rewardAmount);

      expect(await vault.rewardPerTokenStored()).to.equal(0n);
      expect(await taxToken.balanceOf(await vault.getAddress())).to.equal(
        rewardAmount
      );
    });
  });

  // --- Lock Period ----

  describe("Lock Period", function () {
    it("should have default 7-day lock period", async function () {
      expect(await vault.minLockPeriod()).to.equal(SEVEN_DAYS);
    });

    it("should allow owner to update lock period", async function () {
      const newPeriod = 14 * 24 * 60 * 60; // 14 days
      await expect(vault.setMinLockPeriod(newPeriod))
        .to.emit(vault, "MinLockPeriodUpdated")
        .withArgs(newPeriod);
      expect(await vault.minLockPeriod()).to.equal(newPeriod);
    });

    it("should revert when non-owner sets lock period", async function () {
      await expect(
        vault.connect(alice).setMinLockPeriod(0)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("should apply new lock period to new stakes", async function () {
      await vault.connect(alice).stake(ethers.parseEther("1000"));

      // Change lock period to 1 day
      await vault.setMinLockPeriod(86400);

      await increaseTime(86401);
      await expect(vault.connect(alice).withdraw(ethers.parseEther("1000"))).to
        .not.be.reverted;
    });

    it("should emit MinLockPeriodUpdated event on setMinLockPeriod", async function () {
      const newPeriod = 86400;
      await expect(vault.setMinLockPeriod(newPeriod))
        .to.emit(vault, "MinLockPeriodUpdated")
        .withArgs(newPeriod);
    });
  });

  // --- View Functions ----

  describe("View Functions", function () {
    it("should return staked balance via getStakedBalance", async function () {
      await vault.connect(alice).stake(ethers.parseEther("5000"));
      expect(await vault.getStakedBalance(alice.address)).to.equal(
        ethers.parseEther("5000")
      );
    });

    it("should return earned rewards via getEarnedRewards", async function () {
      await vault.connect(alice).stake(ethers.parseEther("10000"));
      const rewardAmount = ethers.parseEther("500");
      await taxToken.approve(await vault.getAddress(), rewardAmount);
      await vault.addRewards(rewardAmount);

      expect(await vault.getEarnedRewards(alice.address)).to.equal(rewardAmount);
    });
  });
});
