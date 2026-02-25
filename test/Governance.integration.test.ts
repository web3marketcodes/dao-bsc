import { expect } from "chai";
import { ethers } from "hardhat";
import {
  DAOToken,
  DAOGovernor,
  DAOTimelock,
  TaxToken,
  RevenueSplitter,
  StakingVault,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { mineBlocks, increaseTime, ProposalState, VoteType } from "./helpers";

describe("Governance Integration", function () {
  let daoToken: DAOToken;
  let timelock: DAOTimelock;
  let governor: DAOGovernor;
  let taxToken: TaxToken;
  let splitter: RevenueSplitter;
  let vault: StakingVault;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let devWallet: SignerWithAddress;
  let pair: SignerWithAddress;
  let bob: SignerWithAddress;

  const INITIAL_SUPPLY = 1_000_000n;
  const TAX_SUPPLY = 1_000_000n;
  const VOTING_DELAY = 1;
  const VOTING_PERIOD = 50;
  const PROPOSAL_THRESHOLD = 0;
  const QUORUM_PERCENTAGE = 4;
  const TIMELOCK_DELAY = 3600;

  async function getProposalId(tx: any): Promise<bigint> {
    const receipt = await tx.wait();
    const event = receipt?.logs.find((log: any) => {
      try {
        return (
          governor.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          })?.name === "ProposalCreated"
        );
      } catch {
        return false;
      }
    });
    const parsed = governor.interface.parseLog({
      topics: event!.topics as string[],
      data: event!.data,
    });
    return parsed!.args.proposalId;
  }

  async function proposeVoteQueueExecute(
    targets: string[],
    values: bigint[],
    calldatas: string[],
    description: string,
    voter?: SignerWithAddress
  ): Promise<bigint> {
    const descriptionHash = ethers.id(description);
    const proposer = voter || deployer;
    const tx = await governor.connect(proposer).propose(targets, values, calldatas, description);
    const proposalId = await getProposalId(tx);

    await mineBlocks(VOTING_DELAY + 1);
    await governor.connect(proposer).castVote(proposalId, VoteType.For);
    await mineBlocks(VOTING_PERIOD + 1);

    await governor.queue(targets, values, calldatas, descriptionHash);
    await increaseTime(TIMELOCK_DELAY + 1);
    await governor.execute(targets, values, calldatas, descriptionHash);

    return proposalId;
  }

  beforeEach(async function () {
    [deployer, alice, devWallet, pair, bob] = await ethers.getSigners();

    // Deploy core DAO contracts
    const tokenFactory = await ethers.getContractFactory("DAOToken");
    daoToken = await tokenFactory.deploy("DAOToken", "DAO", INITIAL_SUPPLY);

    const timelockFactory = await ethers.getContractFactory("DAOTimelock");
    timelock = await timelockFactory.deploy(TIMELOCK_DELAY, [], [], deployer.address);

    const governorFactory = await ethers.getContractFactory("DAOGovernor");
    governor = await governorFactory.deploy(
      await daoToken.getAddress(),
      await timelock.getAddress(),
      VOTING_DELAY,
      VOTING_PERIOD,
      PROPOSAL_THRESHOLD,
      QUORUM_PERCENTAGE
    );

    // Deploy new economic contracts
    const taxFactory = await ethers.getContractFactory("TaxToken");
    taxToken = await taxFactory.deploy("TaxToken", "TAX", TAX_SUPPLY, deployer.address);

    const vaultFactory = await ethers.getContractFactory("StakingVault");
    vault = await vaultFactory.deploy(
      await daoToken.getAddress(),
      await taxToken.getAddress(),
      deployer.address
    );

    const splitterFactory = await ethers.getContractFactory("RevenueSplitter");
    splitter = await splitterFactory.deploy(
      await taxToken.getAddress(),
      await vault.getAddress(),
      devWallet.address,
      deployer.address
    );

    // Configure TaxToken
    await taxToken.setTaxRecipient(await splitter.getAddress());
    await taxToken.setTaxExempt(await splitter.getAddress(), true);
    await taxToken.setLimitExempt(await splitter.getAddress(), true);
    await taxToken.setTaxExempt(await vault.getAddress(), true);
    await taxToken.setLimitExempt(await vault.getAddress(), true);
    await taxToken.setAmmPair(pair.address, true);
    await taxToken.setTradingEnabled(true);

    // Setup governance roles
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
    const ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

    await timelock.grantRole(PROPOSER_ROLE, await governor.getAddress());
    await timelock.grantRole(CANCELLER_ROLE, await governor.getAddress());
    await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress);

    // Transfer ownership to timelock
    await taxToken.transferOwnership(await timelock.getAddress());
    await splitter.transferOwnership(await timelock.getAddress());
    await vault.transferOwnership(await timelock.getAddress());

    // Renounce admin role
    await timelock.renounceRole(ADMIN_ROLE, deployer.address);

    // Delegate voting power
    await daoToken.delegate(deployer.address);
  });

  it("should execute setBuyTax via governance proposal", async function () {
    const newBuyTax = 500n; // 5%
    const targets = [await taxToken.getAddress()];
    const values = [0n];
    const calldatas = [
      taxToken.interface.encodeFunctionData("setBuyTax", [newBuyTax]),
    ];
    const description = "Set buy tax to 5%";

    const proposalId = await proposeVoteQueueExecute(
      targets,
      values,
      calldatas,
      description
    );

    expect(await governor.state(proposalId)).to.equal(ProposalState.Executed);
    expect(await taxToken.buyTax()).to.equal(newBuyTax);
  });

  it("should update revenue split via governance proposal", async function () {
    const targets = [await splitter.getAddress()];
    const values = [0n];
    const calldatas = [
      splitter.interface.encodeFunctionData("setShares", [6000, 1000, 3000]),
    ];
    const description = "Update revenue split: 60% staking, 10% burn, 30% dev";

    await proposeVoteQueueExecute(targets, values, calldatas, description);

    expect(await splitter.stakingShare()).to.equal(6000n);
    expect(await splitter.burnShare()).to.equal(1000n);
    expect(await splitter.devShare()).to.equal(3000n);
  });

  it("should update lock period via governance proposal", async function () {
    const newPeriod = 14 * 24 * 60 * 60; // 14 days
    const targets = [await vault.getAddress()];
    const values = [0n];
    const calldatas = [
      vault.interface.encodeFunctionData("setMinLockPeriod", [newPeriod]),
    ];
    const description = "Update staking lock period to 14 days";

    await proposeVoteQueueExecute(targets, values, calldatas, description);

    expect(await vault.minLockPeriod()).to.equal(newPeriod);
  });

  it("should reject proposal that does not reach quorum", async function () {
    // Transfer most tokens to another address that doesn't delegate
    await daoToken.transfer(alice.address, ethers.parseEther("990000"));

    const targets = [await taxToken.getAddress()];
    const values = [0n];
    const calldatas = [
      taxToken.interface.encodeFunctionData("setBuyTax", [100]),
    ];
    const description = "Low quorum proposal";

    const tx = await governor.propose(targets, values, calldatas, description);
    const proposalId = await getProposalId(tx);

    await mineBlocks(VOTING_DELAY + 1);
    await governor.castVote(proposalId, VoteType.For);
    await mineBlocks(VOTING_PERIOD + 1);

    expect(await governor.state(proposalId)).to.equal(ProposalState.Defeated);
  });

  it("should execute setTaxExempt via governance proposal", async function () {
    const targets = [await taxToken.getAddress()];
    const values = [0n];
    const calldatas = [
      taxToken.interface.encodeFunctionData("setTaxExempt", [alice.address, true]),
    ];
    const description = "Set alice as tax exempt";

    await proposeVoteQueueExecute(targets, values, calldatas, description);

    expect(await taxToken.isTaxExempt(alice.address)).to.be.true;
  });

  it("should handle two proposals running simultaneously", async function () {
    const taxTokenAddr = await taxToken.getAddress();

    // Proposal 1: Set buy tax to 3%
    const targets1 = [taxTokenAddr];
    const values1 = [0n];
    const calldatas1 = [
      taxToken.interface.encodeFunctionData("setBuyTax", [300]),
    ];
    const desc1 = "Set buy tax to 3%";

    const tx1 = await governor.propose(targets1, values1, calldatas1, desc1);
    const propId1 = await getProposalId(tx1);

    // Proposal 2: Set sell tax to 7%
    const targets2 = [taxTokenAddr];
    const values2 = [0n];
    const calldatas2 = [
      taxToken.interface.encodeFunctionData("setSellTax", [700]),
    ];
    const desc2 = "Set sell tax to 7%";

    const tx2 = await governor.propose(targets2, values2, calldatas2, desc2);
    const propId2 = await getProposalId(tx2);

    // Both should be Pending
    expect(await governor.state(propId1)).to.equal(ProposalState.Pending);
    expect(await governor.state(propId2)).to.equal(ProposalState.Pending);

    // Move past voting delay
    await mineBlocks(VOTING_DELAY + 1);

    // Vote For on both
    await governor.castVote(propId1, VoteType.For);
    await governor.castVote(propId2, VoteType.For);

    // Move past voting period
    await mineBlocks(VOTING_PERIOD + 1);

    // Both should be Succeeded
    expect(await governor.state(propId1)).to.equal(ProposalState.Succeeded);
    expect(await governor.state(propId2)).to.equal(ProposalState.Succeeded);

    // Queue and execute both
    await governor.queue(targets1, values1, calldatas1, ethers.id(desc1));
    await governor.queue(targets2, values2, calldatas2, ethers.id(desc2));
    await increaseTime(TIMELOCK_DELAY + 1);

    await governor.execute(targets1, values1, calldatas1, ethers.id(desc1));
    await governor.execute(targets2, values2, calldatas2, ethers.id(desc2));

    // Verify both executed
    expect(await taxToken.buyTax()).to.equal(300n);
    expect(await taxToken.sellTax()).to.equal(700n);
  });

  it("should defeat a proposal with majority Against votes", async function () {
    // Give alice 600k tokens (majority)
    await daoToken.transfer(alice.address, ethers.parseEther("600000"));
    await daoToken.connect(alice).delegate(alice.address);
    await mineBlocks(1);

    const targets = [await taxToken.getAddress()];
    const values = [0n];
    const calldatas = [
      taxToken.interface.encodeFunctionData("setBuyTax", [2500]),
    ];
    const description = "Set buy tax to 25% (should be defeated)";

    const tx = await governor.propose(targets, values, calldatas, description);
    const proposalId = await getProposalId(tx);

    await mineBlocks(VOTING_DELAY + 1);

    // Deployer votes For (400k), Alice votes Against (600k)
    await governor.castVote(proposalId, VoteType.For);
    await governor.connect(alice).castVote(proposalId, VoteType.Against);

    await mineBlocks(VOTING_PERIOD + 1);

    expect(await governor.state(proposalId)).to.equal(ProposalState.Defeated);
  });

  it("should complete end-to-end tax flow: buy -> tax -> distribute -> staking vault -> claim", async function () {
    // 1. Setup: stake DAOTokens in vault
    const stakeAmount = ethers.parseEther("50000");
    await daoToken.approve(await vault.getAddress(), stakeAmount);
    await vault.stake(stakeAmount);

    // 2. Fund pair with TaxTokens for simulated buys
    await taxToken.transfer(pair.address, ethers.parseEther("100000"));

    // 3. Simulate buy: pair -> alice (triggers buy tax)
    const buyAmount = ethers.parseEther("10000");
    await taxToken.connect(pair).transfer(alice.address, buyAmount);

    // 4. Check tax was collected by RevenueSplitter
    const expectedTax = (buyAmount * 500n) / 10000n; // 5% buy tax
    const splitterBalance = await taxToken.balanceOf(await splitter.getAddress());
    expect(splitterBalance).to.equal(expectedTax);

    // 5. Distribute revenue
    await splitter.distribute();

    // 6. Check staking vault received its share
    const expectedStakingReward = (expectedTax * 5000n) / 10000n; // 50% of tax
    const vaultBalance = await taxToken.balanceOf(await vault.getAddress());
    expect(vaultBalance).to.equal(expectedStakingReward);

    // 7. Claim rewards
    const earned = await vault.earned(deployer.address);
    expect(earned).to.equal(expectedStakingReward);

    await vault.claimRewards();
    expect(await vault.earned(deployer.address)).to.equal(0n);
  });

  it("should complete full cycle: tax collection -> distribute -> stake -> earn -> claim with multiple users", async function () {
    // Give alice and bob DAO tokens for staking
    await daoToken.transfer(alice.address, ethers.parseEther("100000"));
    await daoToken.transfer(bob.address, ethers.parseEther("100000"));

    // Both approve and stake
    await daoToken.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256);
    await daoToken.connect(bob).approve(await vault.getAddress(), ethers.MaxUint256);

    // Alice stakes 75k, Bob stakes 25k (75/25 split)
    await vault.connect(alice).stake(ethers.parseEther("75000"));
    await vault.connect(bob).stake(ethers.parseEther("25000"));

    // Fund pair and simulate a buy
    await taxToken.transfer(pair.address, ethers.parseEther("200000"));
    const buyAmount = ethers.parseEther("10000");
    // Need a non-exempt buyer - use devWallet as buyer target
    await taxToken.setTaxExempt(devWallet.address, false);
    await taxToken.setLimitExempt(devWallet.address, true);
    await taxToken.connect(pair).transfer(devWallet.address, buyAmount);

    // Tax collected
    const expectedTax = (buyAmount * 500n) / 10000n; // 5%
    const splitterBalance = await taxToken.balanceOf(await splitter.getAddress());
    expect(splitterBalance).to.equal(expectedTax);

    // Distribute
    await splitter.distribute();

    // Staking reward = 50% of tax
    const stakingReward = (expectedTax * 5000n) / 10000n;

    // Alice should get 75% of staking reward, Bob 25%
    const aliceReward = await vault.earned(alice.address);
    const bobReward = await vault.earned(bob.address);

    expect(aliceReward).to.equal((stakingReward * 75000n) / 100000n);
    expect(bobReward).to.equal((stakingReward * 25000n) / 100000n);

    // Both claim
    await vault.connect(alice).claimRewards();
    await vault.connect(bob).claimRewards();

    expect(await vault.earned(alice.address)).to.equal(0n);
    expect(await vault.earned(bob.address)).to.equal(0n);
  });
});
