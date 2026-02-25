import { expect } from "chai";
import { ethers } from "hardhat";
import { TaxToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("TaxToken", function () {
  let taxToken: TaxToken;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let pair: SignerWithAddress; // simulates AMM pair
  let taxRecipient: SignerWithAddress;
  let pair2: SignerWithAddress;

  const NAME = "TaxToken";
  const SYMBOL = "TAX";
  const INITIAL_SUPPLY = 1_000_000n;
  const SUPPLY_WEI = INITIAL_SUPPLY * 10n ** 18n;

  beforeEach(async function () {
    [deployer, alice, bob, pair, taxRecipient, pair2] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("TaxToken");
    taxToken = await factory.deploy(NAME, SYMBOL, INITIAL_SUPPLY, deployer.address);

    // Set tax recipient and AMM pair
    await taxToken.setTaxRecipient(taxRecipient.address);
    await taxToken.setAmmPair(pair.address, true);

    // Enable trading
    await taxToken.setTradingEnabled(true);
  });

  // --- Deployment ----

  describe("Deployment", function () {
    it("should set correct name and symbol", async function () {
      expect(await taxToken.name()).to.equal(NAME);
      expect(await taxToken.symbol()).to.equal(SYMBOL);
    });

    it("should mint initial supply to owner", async function () {
      expect(await taxToken.totalSupply()).to.equal(SUPPLY_WEI);
      expect(await taxToken.balanceOf(deployer.address)).to.equal(SUPPLY_WEI);
    });

    it("should set deployer as tax exempt and limit exempt", async function () {
      expect(await taxToken.isTaxExempt(deployer.address)).to.be.true;
      expect(await taxToken.isLimitExempt(deployer.address)).to.be.true;
    });

    it("should set default tax rates (5% buy, 5% sell)", async function () {
      expect(await taxToken.buyTax()).to.equal(500n);
      expect(await taxToken.sellTax()).to.equal(500n);
    });

    it("should set default anti-whale limits", async function () {
      expect(await taxToken.maxTransactionAmount()).to.equal(SUPPLY_WEI / 100n);
      expect(await taxToken.maxWalletAmount()).to.equal((SUPPLY_WEI * 2n) / 100n);
    });
  });

  // --- Tax Configuration ----

  describe("Tax Configuration", function () {
    it("should allow owner to set buy tax", async function () {
      await expect(taxToken.setBuyTax(1000))
        .to.emit(taxToken, "BuyTaxUpdated")
        .withArgs(1000);
      expect(await taxToken.buyTax()).to.equal(1000n);
    });

    it("should allow owner to set sell tax", async function () {
      await expect(taxToken.setSellTax(1500))
        .to.emit(taxToken, "SellTaxUpdated")
        .withArgs(1500);
      expect(await taxToken.sellTax()).to.equal(1500n);
    });

    it("should revert if buy tax exceeds MAX_TAX", async function () {
      await expect(taxToken.setBuyTax(2501)).to.be.revertedWith(
        "TaxToken: exceeds MAX_TAX"
      );
    });

    it("should revert if sell tax exceeds MAX_TAX", async function () {
      await expect(taxToken.setSellTax(2501)).to.be.revertedWith(
        "TaxToken: exceeds MAX_TAX"
      );
    });

    it("should allow setting tax at MAX_TAX boundary (2500)", async function () {
      await taxToken.setBuyTax(2500);
      expect(await taxToken.buyTax()).to.equal(2500n);
    });

    it("should revert when non-owner sets tax", async function () {
      await expect(taxToken.connect(alice).setBuyTax(100)).to.be.revertedWithCustomError(
        taxToken,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  // --- Trading Controls ----

  describe("Trading Controls", function () {
    it("should revert transfers when trading disabled and not exempt", async function () {
      await taxToken.setTradingEnabled(false);
      // Transfer tokens to alice first (deployer is exempt, so this works)
      await taxToken.transfer(alice.address, ethers.parseEther("1000"));
      // Alice -> Bob should revert
      await expect(
        taxToken.connect(alice).transfer(bob.address, ethers.parseEther("100"))
      ).to.be.revertedWith("TaxToken: trading not enabled");
    });

    it("should allow exempt accounts to transfer when trading disabled", async function () {
      await taxToken.setTradingEnabled(false);
      // Deployer is exempt, should work
      await expect(
        taxToken.transfer(alice.address, ethers.parseEther("100"))
      ).to.not.be.reverted;
    });

    it("should allow transfers when trading is enabled", async function () {
      await taxToken.setLimitExempt(alice.address, true);
      await taxToken.transfer(alice.address, ethers.parseEther("1000"));
      await expect(
        taxToken.connect(alice).transfer(bob.address, ethers.parseEther("100"))
      ).to.not.be.reverted;
    });
  });

  // --- Anti-Whale Limits ----

  describe("Anti-Whale Limits", function () {
    it("should revert when exceeding maxTransactionAmount", async function () {
      await taxToken.setLimitExempt(alice.address, true);
      await taxToken.transfer(alice.address, ethers.parseEther("20000"));
      await taxToken.setLimitExempt(alice.address, false);

      await expect(
        taxToken.connect(alice).transfer(bob.address, ethers.parseEther("10001"))
      ).to.be.revertedWith("TaxToken: exceeds maxTransactionAmount");
    });

    it("should revert when exceeding maxWalletAmount", async function () {
      await taxToken.setLimitExempt(alice.address, true);
      await taxToken.transfer(alice.address, ethers.parseEther("10000"));
      await taxToken.transfer(bob.address, ethers.parseEther("10000"));
      await taxToken.setLimitExempt(alice.address, false);

      await taxToken.transfer(bob.address, ethers.parseEther("9999"));
      await expect(
        taxToken.connect(alice).transfer(bob.address, ethers.parseEther("2"))
      ).to.be.revertedWith("TaxToken: exceeds maxWalletAmount");
    });

    it("should allow limit-exempt accounts to bypass", async function () {
      await taxToken.setLimitExempt(alice.address, true);
      await taxToken.transfer(alice.address, ethers.parseEther("500000"));
      expect(await taxToken.balanceOf(alice.address)).to.equal(
        ethers.parseEther("500000")
      );
    });

    it("should skip maxWallet check for sells to AMM pair", async function () {
      await taxToken.transfer(pair.address, ethers.parseEther("500000"));
      await taxToken.transfer(alice.address, ethers.parseEther("5000"));
      await taxToken.setTaxExempt(alice.address, true);
      await expect(
        taxToken.connect(alice).transfer(pair.address, ethers.parseEther("5000"))
      ).to.not.be.reverted;
    });

    it("should allow owner to update maxTransactionAmount", async function () {
      const newMax = ethers.parseEther("50000");
      await expect(taxToken.setMaxTransactionAmount(newMax))
        .to.emit(taxToken, "MaxTransactionAmountUpdated")
        .withArgs(newMax);
      expect(await taxToken.maxTransactionAmount()).to.equal(newMax);
    });

    it("should allow owner to update maxWalletAmount", async function () {
      const newMax = ethers.parseEther("100000");
      await expect(taxToken.setMaxWalletAmount(newMax))
        .to.emit(taxToken, "MaxWalletAmountUpdated")
        .withArgs(newMax);
      expect(await taxToken.maxWalletAmount()).to.equal(newMax);
    });
  });

  // --- Buy Tax ----

  describe("Buy Tax", function () {
    it("should deduct buy tax when transferring from AMM pair", async function () {
      await taxToken.transfer(pair.address, ethers.parseEther("100000"));

      const buyAmount = ethers.parseEther("1000");
      const expectedTax = (buyAmount * 500n) / 10000n; // 5%
      const expectedReceived = buyAmount - expectedTax;

      await taxToken.connect(pair).transfer(alice.address, buyAmount);

      expect(await taxToken.balanceOf(alice.address)).to.equal(expectedReceived);
      expect(await taxToken.balanceOf(taxRecipient.address)).to.equal(expectedTax);
    });

    it("should send correct tax amount to taxRecipient", async function () {
      await taxToken.setBuyTax(1000); // 10%
      await taxToken.transfer(pair.address, ethers.parseEther("100000"));

      const buyAmount = ethers.parseEther("2000");
      await taxToken.connect(pair).transfer(alice.address, buyAmount);

      const expectedTax = (buyAmount * 1000n) / 10000n; // 10%
      expect(await taxToken.balanceOf(taxRecipient.address)).to.equal(expectedTax);
    });

    it("should deduct max tax rate (2500 bps) correctly on buy", async function () {
      await taxToken.setBuyTax(2500); // 25%
      await taxToken.transfer(pair.address, ethers.parseEther("100000"));

      const buyAmount = ethers.parseEther("1000");
      const expectedTax = (buyAmount * 2500n) / 10000n; // 25% = 250 tokens
      const expectedReceived = buyAmount - expectedTax;

      await taxToken.connect(pair).transfer(alice.address, buyAmount);

      expect(await taxToken.balanceOf(alice.address)).to.equal(expectedReceived);
      expect(await taxToken.balanceOf(taxRecipient.address)).to.equal(expectedTax);
    });
  });

  // --- Sell Tax ----

  describe("Sell Tax", function () {
    it("should deduct sell tax when transferring to AMM pair", async function () {
      await taxToken.transfer(alice.address, ethers.parseEther("10000"));

      const sellAmount = ethers.parseEther("1000");
      const expectedTax = (sellAmount * 500n) / 10000n; // 5%
      const expectedToPair = sellAmount - expectedTax;

      const pairBalBefore = await taxToken.balanceOf(pair.address);

      await taxToken.connect(alice).transfer(pair.address, sellAmount);

      const pairBalAfter = await taxToken.balanceOf(pair.address);
      expect(pairBalAfter - pairBalBefore).to.equal(expectedToPair);
      expect(await taxToken.balanceOf(taxRecipient.address)).to.equal(expectedTax);
    });

    it("should deduct max tax rate (2500 bps) correctly on sell", async function () {
      await taxToken.setSellTax(2500); // 25%
      await taxToken.transfer(alice.address, ethers.parseEther("10000"));

      const sellAmount = ethers.parseEther("1000");
      const expectedTax = (sellAmount * 2500n) / 10000n; // 25% = 250 tokens
      const expectedToPair = sellAmount - expectedTax;

      await taxToken.connect(alice).transfer(pair.address, sellAmount);

      expect(await taxToken.balanceOf(taxRecipient.address)).to.equal(expectedTax);
      expect(await taxToken.balanceOf(pair.address)).to.equal(expectedToPair);
    });
  });

  // --- Normal Transfers (No Tax) ----

  describe("Normal Transfers", function () {
    it("should not apply tax on wallet-to-wallet transfers", async function () {
      await taxToken.transfer(alice.address, ethers.parseEther("10000"));

      const transferAmount = ethers.parseEther("5000");
      await taxToken.connect(alice).transfer(bob.address, transferAmount);

      expect(await taxToken.balanceOf(bob.address)).to.equal(transferAmount);
      expect(await taxToken.balanceOf(taxRecipient.address)).to.equal(0n);
    });
  });

  // --- Tax Exemption Logic ----

  describe("Tax Exemption Logic", function () {
    it("should skip tax when sender is tax-exempt (buy from exempt pair)", async function () {
      // Mark pair as tax-exempt
      await taxToken.setTaxExempt(pair.address, true);
      await taxToken.transfer(pair.address, ethers.parseEther("100000"));

      const buyAmount = ethers.parseEther("1000");
      await taxToken.connect(pair).transfer(alice.address, buyAmount);

      // No tax deducted because sender (pair) is exempt
      expect(await taxToken.balanceOf(alice.address)).to.equal(buyAmount);
      expect(await taxToken.balanceOf(taxRecipient.address)).to.equal(0n);
    });

    it("should skip tax when buyer is tax-exempt", async function () {
      // Mark alice as tax-exempt
      await taxToken.setTaxExempt(alice.address, true);
      await taxToken.transfer(pair.address, ethers.parseEther("100000"));

      const buyAmount = ethers.parseEther("1000");
      await taxToken.connect(pair).transfer(alice.address, buyAmount);

      // No tax deducted because buyer (alice) is exempt
      expect(await taxToken.balanceOf(alice.address)).to.equal(buyAmount);
      expect(await taxToken.balanceOf(taxRecipient.address)).to.equal(0n);
    });

    it("should skip tax when seller is tax-exempt on sell", async function () {
      // Mark alice as tax-exempt
      await taxToken.setTaxExempt(alice.address, true);
      await taxToken.setLimitExempt(alice.address, true);
      await taxToken.transfer(alice.address, ethers.parseEther("10000"));

      const sellAmount = ethers.parseEther("1000");
      await taxToken.connect(alice).transfer(pair.address, sellAmount);

      // No tax because seller is exempt
      expect(await taxToken.balanceOf(pair.address)).to.equal(sellAmount);
      expect(await taxToken.balanceOf(taxRecipient.address)).to.equal(0n);
    });
  });

  // --- Multiple AMM Pairs ----

  describe("Multiple AMM Pairs", function () {
    it("should apply buy tax from second AMM pair", async function () {
      await taxToken.setAmmPair(pair2.address, true);
      await taxToken.transfer(pair2.address, ethers.parseEther("100000"));

      const buyAmount = ethers.parseEther("1000");
      const expectedTax = (buyAmount * 500n) / 10000n;

      await taxToken.connect(pair2).transfer(alice.address, buyAmount);

      expect(await taxToken.balanceOf(alice.address)).to.equal(buyAmount - expectedTax);
      expect(await taxToken.balanceOf(taxRecipient.address)).to.equal(expectedTax);
    });

    it("should apply sell tax to second AMM pair", async function () {
      await taxToken.setAmmPair(pair2.address, true);
      await taxToken.transfer(alice.address, ethers.parseEther("10000"));

      const sellAmount = ethers.parseEther("1000");
      const expectedTax = (sellAmount * 500n) / 10000n;

      await taxToken.connect(alice).transfer(pair2.address, sellAmount);

      expect(await taxToken.balanceOf(pair2.address)).to.equal(sellAmount - expectedTax);
      expect(await taxToken.balanceOf(taxRecipient.address)).to.equal(expectedTax);
    });
  });

  // --- Sequential Tax Accumulation ----

  describe("Sequential Tax Accumulation", function () {
    it("should accumulate taxes from sequential buy + sell to taxRecipient", async function () {
      await taxToken.transfer(pair.address, ethers.parseEther("100000"));

      // Buy: pair -> alice
      const buyAmount = ethers.parseEther("1000");
      const buyTax = (buyAmount * 500n) / 10000n;
      await taxToken.connect(pair).transfer(alice.address, buyAmount);

      // Sell: alice -> pair
      const aliceBalance = await taxToken.balanceOf(alice.address);
      const sellTax = (aliceBalance * 500n) / 10000n;
      await taxToken.connect(alice).transfer(pair.address, aliceBalance);

      // Tax recipient should have accumulated both taxes
      const totalTax = buyTax + sellTax;
      expect(await taxToken.balanceOf(taxRecipient.address)).to.equal(totalTax);
    });
  });

  // --- Ownership ----

  describe("Ownership", function () {
    it("should allow ownership transfer and new owner can set parameters", async function () {
      await taxToken.transferOwnership(alice.address);
      expect(await taxToken.owner()).to.equal(alice.address);

      // New owner can set buy tax
      await taxToken.connect(alice).setBuyTax(1000);
      expect(await taxToken.buyTax()).to.equal(1000n);
    });
  });

  // --- Access Control for All Admin Functions ----

  describe("Access Control", function () {
    it("should revert setSellTax for non-owner", async function () {
      await expect(
        taxToken.connect(alice).setSellTax(100)
      ).to.be.revertedWithCustomError(taxToken, "OwnableUnauthorizedAccount");
    });

    it("should revert setTaxRecipient for non-owner", async function () {
      await expect(
        taxToken.connect(alice).setTaxRecipient(bob.address)
      ).to.be.revertedWithCustomError(taxToken, "OwnableUnauthorizedAccount");
    });

    it("should revert setMaxTransactionAmount for non-owner", async function () {
      await expect(
        taxToken.connect(alice).setMaxTransactionAmount(ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(taxToken, "OwnableUnauthorizedAccount");
    });

    it("should revert setMaxWalletAmount for non-owner", async function () {
      await expect(
        taxToken.connect(alice).setMaxWalletAmount(ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(taxToken, "OwnableUnauthorizedAccount");
    });

    it("should revert setTradingEnabled for non-owner", async function () {
      await expect(
        taxToken.connect(alice).setTradingEnabled(false)
      ).to.be.revertedWithCustomError(taxToken, "OwnableUnauthorizedAccount");
    });

    it("should revert setAmmPair for non-owner", async function () {
      await expect(
        taxToken.connect(alice).setAmmPair(bob.address, true)
      ).to.be.revertedWithCustomError(taxToken, "OwnableUnauthorizedAccount");
    });

    it("should revert setTaxExempt for non-owner", async function () {
      await expect(
        taxToken.connect(alice).setTaxExempt(bob.address, true)
      ).to.be.revertedWithCustomError(taxToken, "OwnableUnauthorizedAccount");
    });

    it("should revert setLimitExempt for non-owner", async function () {
      await expect(
        taxToken.connect(alice).setLimitExempt(bob.address, true)
      ).to.be.revertedWithCustomError(taxToken, "OwnableUnauthorizedAccount");
    });
  });

  // --- Event Emissions ----

  describe("Event Emissions", function () {
    it("should emit TaxRecipientUpdated", async function () {
      await expect(taxToken.setTaxRecipient(bob.address))
        .to.emit(taxToken, "TaxRecipientUpdated")
        .withArgs(bob.address);
    });

    it("should emit TradingEnabled", async function () {
      await expect(taxToken.setTradingEnabled(false))
        .to.emit(taxToken, "TradingEnabled")
        .withArgs(false);
    });

    it("should emit AmmPairUpdated", async function () {
      await expect(taxToken.setAmmPair(bob.address, true))
        .to.emit(taxToken, "AmmPairUpdated")
        .withArgs(bob.address, true);
    });

    it("should emit TaxExemptUpdated", async function () {
      await expect(taxToken.setTaxExempt(bob.address, true))
        .to.emit(taxToken, "TaxExemptUpdated")
        .withArgs(bob.address, true);
    });

    it("should emit LimitExemptUpdated", async function () {
      await expect(taxToken.setLimitExempt(bob.address, true))
        .to.emit(taxToken, "LimitExemptUpdated")
        .withArgs(bob.address, true);
    });
  });

  // --- Edge Cases ----

  describe("Edge Cases", function () {
    it("should handle 1 wei transfer", async function () {
      await taxToken.transfer(pair.address, ethers.parseEther("10000"));
      await taxToken.connect(pair).transfer(alice.address, 1n);
      expect(await taxToken.balanceOf(alice.address)).to.equal(1n);
    });

    it("should not deduct tax when tax is 0%", async function () {
      await taxToken.setBuyTax(0);
      await taxToken.setSellTax(0);
      await taxToken.transfer(pair.address, ethers.parseEther("100000"));

      const buyAmount = ethers.parseEther("1000");
      await taxToken.connect(pair).transfer(alice.address, buyAmount);
      expect(await taxToken.balanceOf(alice.address)).to.equal(buyAmount);
    });

    it("should not deduct tax when taxRecipient is address(0)", async function () {
      await taxToken.setTaxRecipient(ethers.ZeroAddress);
      await taxToken.transfer(pair.address, ethers.parseEther("100000"));

      const buyAmount = ethers.parseEther("1000");
      await taxToken.connect(pair).transfer(alice.address, buyAmount);
      expect(await taxToken.balanceOf(alice.address)).to.equal(buyAmount);
    });

    it("should allow setting and unsetting AMM pair", async function () {
      const newPair = bob.address;
      await taxToken.setAmmPair(newPair, true);
      expect(await taxToken.isAmmPair(newPair)).to.be.true;
      await taxToken.setAmmPair(newPair, false);
      expect(await taxToken.isAmmPair(newPair)).to.be.false;
    });

    it("should allow setting and unsetting tax exempt", async function () {
      await taxToken.setTaxExempt(alice.address, true);
      expect(await taxToken.isTaxExempt(alice.address)).to.be.true;
      await taxToken.setTaxExempt(alice.address, false);
      expect(await taxToken.isTaxExempt(alice.address)).to.be.false;
    });
  });
});
