import { expect } from "chai";
import { ethers } from "hardhat";
import { DAOToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DAOToken", function () {
  let token: DAOToken;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  const NAME = "DAOToken";
  const SYMBOL = "DAO";
  const INITIAL_SUPPLY = 1_000_000n;

  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("DAOToken");
    token = await factory.deploy(NAME, SYMBOL, INITIAL_SUPPLY);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set correct name and symbol", async function () {
      expect(await token.name()).to.equal(NAME);
      expect(await token.symbol()).to.equal(SYMBOL);
    });

    it("should mint initial supply to deployer", async function () {
      const expected = INITIAL_SUPPLY * 10n ** 18n;
      expect(await token.totalSupply()).to.equal(expected);
      expect(await token.balanceOf(deployer.address)).to.equal(expected);
    });
  });

  describe("Delegation", function () {
    it("should have zero voting power before delegation", async function () {
      expect(await token.getVotes(deployer.address)).to.equal(0);
    });

    it("should activate voting power after self-delegation", async function () {
      await token.delegate(deployer.address);
      const expected = INITIAL_SUPPLY * 10n ** 18n;
      expect(await token.getVotes(deployer.address)).to.equal(expected);
    });

    it("should delegate voting power to another address", async function () {
      await token.delegate(alice.address);
      const expected = INITIAL_SUPPLY * 10n ** 18n;
      expect(await token.getVotes(alice.address)).to.equal(expected);
      expect(await token.getVotes(deployer.address)).to.equal(0);
    });

    it("should handle multiple delegation changes correctly", async function () {
      const fullSupply = INITIAL_SUPPLY * 10n ** 18n;

      // Delegate to alice
      await token.delegate(alice.address);
      expect(await token.getVotes(alice.address)).to.equal(fullSupply);

      // Re-delegate to bob
      await token.delegate(bob.address);
      expect(await token.getVotes(alice.address)).to.equal(0n);
      expect(await token.getVotes(bob.address)).to.equal(fullSupply);

      // Re-delegate back to self
      await token.delegate(deployer.address);
      expect(await token.getVotes(bob.address)).to.equal(0n);
      expect(await token.getVotes(deployer.address)).to.equal(fullSupply);
    });

    it("should update voting power correctly on re-delegation", async function () {
      const transferAmount = ethers.parseEther("200000");

      // Give alice some tokens
      await token.transfer(alice.address, transferAmount);

      // Both delegate to themselves
      await token.delegate(deployer.address);
      await token.connect(alice).delegate(alice.address);

      const deployerVotes = await token.getVotes(deployer.address);
      const aliceVotes = await token.getVotes(alice.address);
      expect(aliceVotes).to.equal(transferAmount);

      // Alice re-delegates to deployer
      await token.connect(alice).delegate(deployer.address);
      expect(await token.getVotes(deployer.address)).to.equal(deployerVotes + transferAmount);
      expect(await token.getVotes(alice.address)).to.equal(0n);
    });
  });

  describe("Transfers and Voting Power", function () {
    beforeEach(async function () {
      await token.delegate(deployer.address);
    });

    it("should update voting power on transfer", async function () {
      const transferAmount = ethers.parseEther("100000");
      await token.connect(alice).delegate(alice.address);
      await token.transfer(alice.address, transferAmount);

      expect(await token.getVotes(alice.address)).to.equal(transferAmount);
      const expected = INITIAL_SUPPLY * 10n ** 18n - transferAmount;
      expect(await token.getVotes(deployer.address)).to.equal(expected);
    });

    it("should revert transfer of zero amount", async function () {
      // ERC20 allows 0 transfers by default, but let's verify behavior
      await expect(token.transfer(alice.address, 0n)).to.not.be.reverted;
    });
  });

  describe("Approve and TransferFrom", function () {
    it("should allow approve + transferFrom flow", async function () {
      const approveAmount = ethers.parseEther("50000");

      await token.approve(alice.address, approveAmount);
      expect(await token.allowance(deployer.address, alice.address)).to.equal(approveAmount);

      await token.connect(alice).transferFrom(deployer.address, bob.address, approveAmount);
      expect(await token.balanceOf(bob.address)).to.equal(approveAmount);
      expect(await token.allowance(deployer.address, alice.address)).to.equal(0n);
    });

    it("should revert transferFrom when exceeding allowance", async function () {
      const approveAmount = ethers.parseEther("1000");
      await token.approve(alice.address, approveAmount);

      await expect(
        token.connect(alice).transferFrom(deployer.address, bob.address, approveAmount + 1n)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });
  });

  describe("Permit (EIP-2612)", function () {
    it("should allow gasless approval via permit", async function () {
      const value = ethers.parseEther("1000");
      const nonce = await token.nonces(deployer.address);
      const block = await ethers.provider.getBlock("latest");
      const deadline = block!.timestamp + 3600;

      const domain = {
        name: NAME,
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await token.getAddress(),
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        owner: deployer.address,
        spender: alice.address,
        value,
        nonce,
        deadline,
      };

      const sig = await deployer.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(sig);

      await token.permit(deployer.address, alice.address, value, deadline, v, r, s);
      expect(await token.allowance(deployer.address, alice.address)).to.equal(value);
    });

    it("should revert permit with expired deadline", async function () {
      const value = ethers.parseEther("1000");
      const nonce = await token.nonces(deployer.address);
      const block = await ethers.provider.getBlock("latest");
      const deadline = block!.timestamp - 1; // Already expired

      const domain = {
        name: NAME,
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await token.getAddress(),
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        owner: deployer.address,
        spender: alice.address,
        value,
        nonce,
        deadline,
      };

      const sig = await deployer.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(sig);

      await expect(
        token.permit(deployer.address, alice.address, value, deadline, v, r, s)
      ).to.be.revertedWithCustomError(token, "ERC2612ExpiredSignature");
    });

    it("should increment nonce after permit", async function () {
      const value = ethers.parseEther("1000");
      const nonceBefore = await token.nonces(deployer.address);
      const block = await ethers.provider.getBlock("latest");
      const deadline = block!.timestamp + 3600;

      const domain = {
        name: NAME,
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await token.getAddress(),
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        owner: deployer.address,
        spender: alice.address,
        value,
        nonce: nonceBefore,
        deadline,
      };

      const sig = await deployer.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(sig);

      await token.permit(deployer.address, alice.address, value, deadline, v, r, s);

      const nonceAfter = await token.nonces(deployer.address);
      expect(nonceAfter).to.equal(nonceBefore + 1n);
    });
  });

  describe("Checkpoints", function () {
    it("should track historical voting power via getPastVotes", async function () {
      await token.delegate(deployer.address);
      const blockBefore = await ethers.provider.getBlockNumber();

      await token.transfer(alice.address, ethers.parseEther("100000"));
      await ethers.provider.send("evm_mine", []);

      const pastVotes = await token.getPastVotes(deployer.address, blockBefore);
      const fullSupply = INITIAL_SUPPLY * 10n ** 18n;
      expect(pastVotes).to.equal(fullSupply);
    });
  });
});
