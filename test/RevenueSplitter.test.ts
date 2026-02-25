import { expect } from "chai";
import { ethers } from "hardhat";
import { TaxToken, RevenueSplitter, StakingVault } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DAOToken } from "../typechain-types";

describe("RevenueSplitter", function () {
  let taxToken: TaxToken;
  let daoToken: DAOToken;
  let splitter: RevenueSplitter;
  let stakingVault: StakingVault;
  let deployer: SignerWithAddress;
  let devWallet: SignerWithAddress;
  let alice: SignerWithAddress;

  const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
  const TAX_SUPPLY = 1_000_000n;

  beforeEach(async function () {
    [deployer, devWallet, alice] = await ethers.getSigners();

    // Deploy DAOToken (staking token for vault)
    const daoFactory = await ethers.getContractFactory("DAOToken");
    daoToken = await daoFactory.deploy("DAOToken", "DAO", 1_000_000n);

    // Deploy TaxToken
    const taxFactory = await ethers.getContractFactory("TaxToken");
    taxToken = await taxFactory.deploy("TaxToken", "TAX", TAX_SUPPLY, deployer.address);

    // Deploy StakingVault
    const vaultFactory = await ethers.getContractFactory("StakingVault");
    stakingVault = await vaultFactory.deploy(
      await daoToken.getAddress(),
      await taxToken.getAddress(),
      deployer.address
    );

    // Deploy RevenueSplitter
    const splitterFactory = await ethers.getContractFactory("RevenueSplitter");
    splitter = await splitterFactory.deploy(
      await taxToken.getAddress(),
      await stakingVault.getAddress(),
      devWallet.address,
      deployer.address
    );

    // Enable trading and set exemptions for contracts
    await taxToken.setTradingEnabled(true);
    await taxToken.setTaxExempt(await splitter.getAddress(), true);
    await taxToken.setLimitExempt(await splitter.getAddress(), true);
    await taxToken.setTaxExempt(await stakingVault.getAddress(), true);
    await taxToken.setLimitExempt(await stakingVault.getAddress(), true);
    await taxToken.setTaxExempt(devWallet.address, true);
    await taxToken.setLimitExempt(devWallet.address, true);
  });

  // --- Deployment ----

  describe("Deployment", function () {
    it("should set correct taxToken address", async function () {
      expect(await splitter.taxToken()).to.equal(await taxToken.getAddress());
    });

    it("should set correct stakingVault address", async function () {
      expect(await splitter.stakingVault()).to.equal(await stakingVault.getAddress());
    });

    it("should set correct devWallet address", async function () {
      expect(await splitter.devWallet()).to.equal(devWallet.address);
    });

    it("should set default shares (50% staking, 20% burn, 30% dev)", async function () {
      expect(await splitter.stakingShare()).to.equal(5000n);
      expect(await splitter.burnShare()).to.equal(2000n);
      expect(await splitter.devShare()).to.equal(3000n);
    });
  });

  // --- Share Configuration ----

  describe("Share Configuration", function () {
    it("should allow owner to update shares", async function () {
      await expect(splitter.setShares(6000, 1000, 3000))
        .to.emit(splitter, "SharesUpdated")
        .withArgs(6000, 1000, 3000);
      expect(await splitter.stakingShare()).to.equal(6000n);
      expect(await splitter.burnShare()).to.equal(1000n);
      expect(await splitter.devShare()).to.equal(3000n);
    });

    it("should revert if shares exceed 100%", async function () {
      await expect(splitter.setShares(5000, 3000, 3000)).to.be.revertedWith(
        "RevenueSplitter: shares exceed 100%"
      );
    });

    it("should allow shares summing to less than 100%", async function () {
      await splitter.setShares(3000, 2000, 2000);
      expect(await splitter.stakingShare()).to.equal(3000n);
    });

    it("should revert when non-owner sets shares", async function () {
      await expect(
        splitter.connect(devWallet).setShares(5000, 2000, 3000)
      ).to.be.revertedWithCustomError(splitter, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to update devWallet", async function () {
      await expect(splitter.setDevWallet(deployer.address))
        .to.emit(splitter, "DevWalletUpdated")
        .withArgs(deployer.address);
    });

    it("should allow owner to update stakingVault", async function () {
      await expect(splitter.setStakingVault(deployer.address))
        .to.emit(splitter, "StakingVaultUpdated")
        .withArgs(deployer.address);
    });

    it("should revert setDevWallet for non-owner", async function () {
      await expect(
        splitter.connect(alice).setDevWallet(alice.address)
      ).to.be.revertedWithCustomError(splitter, "OwnableUnauthorizedAccount");
    });

    it("should revert setStakingVault for non-owner", async function () {
      await expect(
        splitter.connect(alice).setStakingVault(alice.address)
      ).to.be.revertedWithCustomError(splitter, "OwnableUnauthorizedAccount");
    });
  });

  // --- Distribution ----

  describe("Distribution", function () {
    const FUND_AMOUNT = ethers.parseEther("10000");

    beforeEach(async function () {
      // Fund the splitter with TaxTokens
      await taxToken.setTaxExempt(deployer.address, true);
      await taxToken.setLimitExempt(deployer.address, true);
      await taxToken.transfer(await splitter.getAddress(), FUND_AMOUNT);
    });

    it("should distribute correct staking amount via addRewards", async function () {
      await daoToken.approve(await stakingVault.getAddress(), ethers.parseEther("1000"));
      await stakingVault.stake(ethers.parseEther("1000"));

      await splitter.distribute();

      const expectedStaking = (FUND_AMOUNT * 5000n) / 10000n;
      expect(await taxToken.balanceOf(await stakingVault.getAddress())).to.equal(
        expectedStaking
      );
    });

    it("should burn correct amount to dead address", async function () {
      await daoToken.approve(await stakingVault.getAddress(), ethers.parseEther("1000"));
      await stakingVault.stake(ethers.parseEther("1000"));

      await splitter.distribute();

      const expectedBurn = (FUND_AMOUNT * 2000n) / 10000n;
      expect(await taxToken.balanceOf(DEAD_ADDRESS)).to.equal(expectedBurn);
    });

    it("should send dev share (with remainder) to devWallet", async function () {
      await daoToken.approve(await stakingVault.getAddress(), ethers.parseEther("1000"));
      await stakingVault.stake(ethers.parseEther("1000"));

      await splitter.distribute();

      const stakingAmount = (FUND_AMOUNT * 5000n) / 10000n;
      const burnAmount = (FUND_AMOUNT * 2000n) / 10000n;
      const expectedDev = FUND_AMOUNT - stakingAmount - burnAmount;
      expect(await taxToken.balanceOf(devWallet.address)).to.equal(expectedDev);
    });

    it("should emit RevenueDistributed event", async function () {
      await daoToken.approve(await stakingVault.getAddress(), ethers.parseEther("1000"));
      await stakingVault.stake(ethers.parseEther("1000"));

      const stakingAmount = (FUND_AMOUNT * 5000n) / 10000n;
      const burnAmount = (FUND_AMOUNT * 2000n) / 10000n;
      const devAmount = FUND_AMOUNT - stakingAmount - burnAmount;

      await expect(splitter.distribute())
        .to.emit(splitter, "RevenueDistributed")
        .withArgs(stakingAmount, burnAmount, devAmount);
    });

    it("should revert when nothing to distribute", async function () {
      const splitterFactory = await ethers.getContractFactory("RevenueSplitter");
      const emptySplitter = await splitterFactory.deploy(
        await taxToken.getAddress(),
        await stakingVault.getAddress(),
        devWallet.address,
        deployer.address
      );
      await expect(emptySplitter.distribute()).to.be.revertedWith(
        "RevenueSplitter: nothing to distribute"
      );
    });

    it("should return accumulated balance via view function", async function () {
      expect(await splitter.getAccumulatedBalance()).to.equal(FUND_AMOUNT);
    });

    it("should handle 0% staking share", async function () {
      await splitter.setShares(0, 5000, 5000);
      await splitter.distribute();

      expect(await taxToken.balanceOf(await stakingVault.getAddress())).to.equal(0n);
      expect(await taxToken.balanceOf(DEAD_ADDRESS)).to.equal(FUND_AMOUNT / 2n);
    });

    it("should handle all shares at 0%", async function () {
      await splitter.setShares(0, 0, 0);
      await splitter.distribute();

      expect(await taxToken.balanceOf(devWallet.address)).to.equal(FUND_AMOUNT);
    });

    it("should handle multiple sequential distributions", async function () {
      await daoToken.approve(await stakingVault.getAddress(), ethers.parseEther("1000"));
      await stakingVault.stake(ethers.parseEther("1000"));

      // First distribution
      await splitter.distribute();

      const firstStaking = (FUND_AMOUNT * 5000n) / 10000n;
      const firstBurn = (FUND_AMOUNT * 2000n) / 10000n;
      const firstDev = FUND_AMOUNT - firstStaking - firstBurn;

      // Fund again
      const secondAmount = ethers.parseEther("5000");
      await taxToken.transfer(await splitter.getAddress(), secondAmount);

      // Second distribution
      await splitter.distribute();

      const secondStaking = (secondAmount * 5000n) / 10000n;
      const secondBurn = (secondAmount * 2000n) / 10000n;
      const secondDev = secondAmount - secondStaking - secondBurn;

      expect(await taxToken.balanceOf(await stakingVault.getAddress())).to.equal(firstStaking + secondStaking);
      expect(await taxToken.balanceOf(DEAD_ADDRESS)).to.equal(firstBurn + secondBurn);
      expect(await taxToken.balanceOf(devWallet.address)).to.equal(firstDev + secondDev);
    });

    it("should skip staking portion when stakingVault is address(0)", async function () {
      await splitter.setStakingVault(ethers.ZeroAddress);
      await splitter.distribute();

      // Staking amount is computed but not transferred since vault is address(0)
      const burnAmount = (FUND_AMOUNT * 2000n) / 10000n;
      expect(await taxToken.balanceOf(DEAD_ADDRESS)).to.equal(burnAmount);
    });

    it("should skip dev portion when devWallet is address(0)", async function () {
      await daoToken.approve(await stakingVault.getAddress(), ethers.parseEther("1000"));
      await stakingVault.stake(ethers.parseEther("1000"));

      await splitter.setDevWallet(ethers.ZeroAddress);
      await splitter.distribute();

      const stakingAmount = (FUND_AMOUNT * 5000n) / 10000n;
      const burnAmount = (FUND_AMOUNT * 2000n) / 10000n;

      expect(await taxToken.balanceOf(await stakingVault.getAddress())).to.equal(stakingAmount);
      expect(await taxToken.balanceOf(DEAD_ADDRESS)).to.equal(burnAmount);
    });

    it("should allow anyone to call distribute (not just owner)", async function () {
      await daoToken.approve(await stakingVault.getAddress(), ethers.parseEther("1000"));
      await stakingVault.stake(ethers.parseEther("1000"));

      // Non-owner (alice) calls distribute
      await expect(splitter.connect(alice).distribute()).to.not.be.reverted;
    });
  });
});
