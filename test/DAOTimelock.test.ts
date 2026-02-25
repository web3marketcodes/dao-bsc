import { expect } from "chai";
import { ethers } from "hardhat";
import { DAOTimelock } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { increaseTime } from "./helpers";

describe("DAOTimelock", function () {
  let timelock: DAOTimelock;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  const MIN_DELAY = 3600; // 1 hour

  let PROPOSER_ROLE: string;
  let EXECUTOR_ROLE: string;
  let CANCELLER_ROLE: string;
  let ADMIN_ROLE: string;

  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("DAOTimelock");
    timelock = await factory.deploy(MIN_DELAY, [], [], deployer.address);
    await timelock.waitForDeployment();

    PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
    ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();
  });

  describe("Deployment", function () {
    it("should set correct minimum delay", async function () {
      expect(await timelock.getMinDelay()).to.equal(MIN_DELAY);
    });

    it("should assign DEFAULT_ADMIN_ROLE to deployer", async function () {
      expect(await timelock.hasRole(ADMIN_ROLE, deployer.address)).to.be.true;
    });

    it("should not have PROPOSER_ROLE assigned initially", async function () {
      expect(await timelock.hasRole(PROPOSER_ROLE, alice.address)).to.be.false;
    });
  });

  describe("Role Management", function () {
    it("should allow admin to grant PROPOSER_ROLE", async function () {
      await timelock.grantRole(PROPOSER_ROLE, alice.address);
      expect(await timelock.hasRole(PROPOSER_ROLE, alice.address)).to.be.true;
    });

    it("should allow admin to grant EXECUTOR_ROLE", async function () {
      await timelock.grantRole(EXECUTOR_ROLE, alice.address);
      expect(await timelock.hasRole(EXECUTOR_ROLE, alice.address)).to.be.true;
    });

    it("should allow admin to grant CANCELLER_ROLE", async function () {
      await timelock.grantRole(CANCELLER_ROLE, alice.address);
      expect(await timelock.hasRole(CANCELLER_ROLE, alice.address)).to.be.true;
    });

    it("should allow admin to revoke a role", async function () {
      await timelock.grantRole(PROPOSER_ROLE, alice.address);
      await timelock.revokeRole(PROPOSER_ROLE, alice.address);
      expect(await timelock.hasRole(PROPOSER_ROLE, alice.address)).to.be.false;
    });

    it("should revert when non-admin tries to grant a role", async function () {
      await expect(
        timelock.connect(alice).grantRole(PROPOSER_ROLE, bob.address)
      ).to.be.revertedWithCustomError(timelock, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Scheduling and Executing Operations", function () {
    let target: string;
    let value: bigint;
    let data: string;
    let predecessor: string;
    let salt: string;

    beforeEach(async function () {
      // Grant proposer and executor roles
      await timelock.grantRole(PROPOSER_ROLE, deployer.address);
      await timelock.grantRole(EXECUTOR_ROLE, deployer.address);

      // Target the timelock itself to call updateDelay (a self-admin function)
      target = await timelock.getAddress();
      value = 0n;
      data = timelock.interface.encodeFunctionData("updateDelay", [7200]);
      predecessor = ethers.ZeroHash;
      salt = ethers.id("test-salt");
    });

    it("should schedule an operation", async function () {
      await expect(
        timelock.schedule(target, value, data, predecessor, salt, MIN_DELAY)
      ).to.emit(timelock, "CallScheduled");
    });

    it("should execute an operation after delay", async function () {
      await timelock.schedule(target, value, data, predecessor, salt, MIN_DELAY);

      // Cannot execute before delay
      await expect(
        timelock.execute(target, value, data, predecessor, salt)
      ).to.be.reverted;

      // Wait for delay
      await increaseTime(MIN_DELAY + 1);

      // Execute
      await timelock.execute(target, value, data, predecessor, salt);

      // Verify the delay was updated
      expect(await timelock.getMinDelay()).to.equal(7200);
    });

    it("should revert execution before delay has passed", async function () {
      await timelock.schedule(target, value, data, predecessor, salt, MIN_DELAY);

      await expect(
        timelock.execute(target, value, data, predecessor, salt)
      ).to.be.reverted;
    });
  });

  describe("Cancellation", function () {
    it("should allow canceller to cancel a scheduled operation", async function () {
      await timelock.grantRole(PROPOSER_ROLE, deployer.address);
      await timelock.grantRole(CANCELLER_ROLE, deployer.address);

      const target = await timelock.getAddress();
      const data = timelock.interface.encodeFunctionData("updateDelay", [7200]);
      const salt = ethers.id("cancel-test");

      await timelock.schedule(target, 0n, data, ethers.ZeroHash, salt, MIN_DELAY);

      const operationId = await timelock.hashOperation(target, 0n, data, ethers.ZeroHash, salt);
      expect(await timelock.isOperationPending(operationId)).to.be.true;

      await expect(timelock.cancel(operationId)).to.emit(timelock, "Cancelled");
      expect(await timelock.isOperationPending(operationId)).to.be.false;
    });
  });

  describe("Access Control", function () {
    it("should revert when non-proposer tries to schedule", async function () {
      const target = await timelock.getAddress();
      const data = timelock.interface.encodeFunctionData("updateDelay", [7200]);
      const salt = ethers.id("unauth-test");

      await expect(
        timelock.connect(alice).schedule(target, 0n, data, ethers.ZeroHash, salt, MIN_DELAY)
      ).to.be.revertedWithCustomError(timelock, "AccessControlUnauthorizedAccount");
    });

    it("should revert when non-canceller tries to cancel", async function () {
      await timelock.grantRole(PROPOSER_ROLE, deployer.address);

      const target = await timelock.getAddress();
      const data = timelock.interface.encodeFunctionData("updateDelay", [7200]);
      const salt = ethers.id("cancel-unauth");

      await timelock.schedule(target, 0n, data, ethers.ZeroHash, salt, MIN_DELAY);
      const operationId = await timelock.hashOperation(target, 0n, data, ethers.ZeroHash, salt);

      await expect(
        timelock.connect(alice).cancel(operationId)
      ).to.be.revertedWithCustomError(timelock, "AccessControlUnauthorizedAccount");
    });
  });
});
