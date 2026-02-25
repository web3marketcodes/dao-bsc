import { expect } from "chai";
import { ethers } from "hardhat";
import { DAOToken, DAOGovernor, DAOTimelock, TaxToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { mineBlocks, increaseTime, ProposalState, VoteType } from "./helpers";

describe("DAOGovernor", function () {
  let token: DAOToken;
  let timelock: DAOTimelock;
  let governor: DAOGovernor;
  let taxToken: TaxToken;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  const INITIAL_SUPPLY = 1_000_000n;
  const VOTING_DELAY = 1;   // 1 block
  const VOTING_PERIOD = 50;  // 50 blocks
  const PROPOSAL_THRESHOLD = 0;
  const QUORUM_PERCENTAGE = 4; // 4%
  const TIMELOCK_DELAY = 3600; // 1 hour

  async function getProposalId(tx: any): Promise<bigint> {
    const receipt = await tx.wait();
    const event = receipt?.logs.find((log: any) => {
      try {
        return governor.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "ProposalCreated";
      } catch { return false; }
    });
    const parsed = governor.interface.parseLog({
      topics: event!.topics as string[],
      data: event!.data,
    });
    return parsed!.args.proposalId;
  }

  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();

    // Deploy token
    const tokenFactory = await ethers.getContractFactory("DAOToken");
    token = await tokenFactory.deploy("DAOToken", "DAO", INITIAL_SUPPLY);

    // Deploy timelock with empty proposers/executors, deployer as admin
    const timelockFactory = await ethers.getContractFactory("DAOTimelock");
    timelock = await timelockFactory.deploy(TIMELOCK_DELAY, [], [], deployer.address);

    // Deploy governor
    const governorFactory = await ethers.getContractFactory("DAOGovernor");
    governor = await governorFactory.deploy(
      await token.getAddress(),
      await timelock.getAddress(),
      VOTING_DELAY,
      VOTING_PERIOD,
      PROPOSAL_THRESHOLD,
      QUORUM_PERCENTAGE
    );

    // Deploy TaxToken owned by deployer initially
    const taxFactory = await ethers.getContractFactory("TaxToken");
    taxToken = await taxFactory.deploy("TaxToken", "TAX", 1_000_000n, deployer.address);

    // Setup roles: governor gets PROPOSER, CANCELLER; address(0) gets EXECUTOR
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();

    await timelock.grantRole(PROPOSER_ROLE, await governor.getAddress());
    await timelock.grantRole(CANCELLER_ROLE, await governor.getAddress());
    await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress);

    // Transfer TaxToken ownership to timelock
    await taxToken.transferOwnership(await timelock.getAddress());

    // Delegate to deployer for voting power
    await token.delegate(deployer.address);
  });

  describe("Deployment", function () {
    it("should set correct voting delay", async function () {
      expect(await governor.votingDelay()).to.equal(VOTING_DELAY);
    });

    it("should set correct voting period", async function () {
      expect(await governor.votingPeriod()).to.equal(VOTING_PERIOD);
    });

    it("should set correct proposal threshold", async function () {
      expect(await governor.proposalThreshold()).to.equal(PROPOSAL_THRESHOLD);
    });

    it("should set correct quorum", async function () {
      const blockNumber = await ethers.provider.getBlockNumber();
      await mineBlocks(1);
      const quorum = await governor.quorum(blockNumber);
      const totalSupply = INITIAL_SUPPLY * 10n ** 18n;
      const expectedQuorum = (totalSupply * BigInt(QUORUM_PERCENTAGE)) / 100n;
      expect(quorum).to.equal(expectedQuorum);
    });
  });

  describe("Proposal Creation", function () {
    it("should create a proposal and emit ProposalCreated", async function () {
      const targets = [await taxToken.getAddress()];
      const values = [0n];
      const calldatas = [
        taxToken.interface.encodeFunctionData("setBuyTax", [1000]),
      ];
      const description = "Set buy tax to 10%";

      await expect(
        governor.propose(targets, values, calldatas, description)
      ).to.emit(governor, "ProposalCreated");
    });
  });

  describe("Voting", function () {
    let proposalId: bigint;
    let targets: string[];
    let values: bigint[];
    let calldatas: string[];
    const description = "Set buy tax to 10%";

    beforeEach(async function () {
      targets = [await taxToken.getAddress()];
      values = [0n];
      calldatas = [
        taxToken.interface.encodeFunctionData("setBuyTax", [1000]),
      ];

      const tx = await governor.propose(targets, values, calldatas, description);
      proposalId = await getProposalId(tx);

      // Move past voting delay
      await mineBlocks(VOTING_DELAY + 1);
    });

    it("should be in Active state after voting delay", async function () {
      expect(await governor.state(proposalId)).to.equal(ProposalState.Active);
    });

    it("should allow casting a vote", async function () {
      await expect(governor.castVote(proposalId, VoteType.For))
        .to.emit(governor, "VoteCast");
    });

    it("should track vote counts correctly", async function () {
      await governor.castVote(proposalId, VoteType.For);
      const [againstVotes, forVotes, abstainVotes] =
        await governor.proposalVotes(proposalId);
      expect(forVotes).to.be.gt(0n);
      expect(againstVotes).to.equal(0n);
      expect(abstainVotes).to.equal(0n);
    });

    it("should lead to Defeated state when Against votes dominate", async function () {
      // Give alice tokens and have her vote against
      const transferAmount = ethers.parseEther("600000");
      await token.transfer(alice.address, transferAmount);
      await token.connect(alice).delegate(alice.address);
      await mineBlocks(1);

      // Create a new proposal after delegation
      const tx2 = await governor.propose(targets, values, calldatas, "Against proposal");
      const propId2 = await getProposalId(tx2);
      await mineBlocks(VOTING_DELAY + 1);

      // Deployer votes For (400k), Alice votes Against (600k)
      await governor.castVote(propId2, VoteType.For);
      await governor.connect(alice).castVote(propId2, VoteType.Against);

      await mineBlocks(VOTING_PERIOD + 1);
      expect(await governor.state(propId2)).to.equal(ProposalState.Defeated);
    });

    it("should lead to Defeated when only abstain votes and no quorum met", async function () {
      // Transfer most tokens away so deployer doesn't have quorum alone
      await token.transfer(alice.address, ethers.parseEther("990000"));

      const tx2 = await governor.propose(targets, values, calldatas, "Abstain-only proposal");
      const propId2 = await getProposalId(tx2);
      await mineBlocks(VOTING_DELAY + 1);

      // Only cast Abstain with small voting power
      await governor.castVote(propId2, VoteType.Abstain);
      await mineBlocks(VOTING_PERIOD + 1);

      expect(await governor.state(propId2)).to.equal(ProposalState.Defeated);
    });

    it("should count multiple voters (For + Against) correctly", async function () {
      const aliceAmount = ethers.parseEther("100000");
      await token.transfer(alice.address, aliceAmount);
      await token.connect(alice).delegate(alice.address);
      await mineBlocks(1);

      const tx2 = await governor.propose(targets, values, calldatas, "Multi-voter proposal");
      const propId2 = await getProposalId(tx2);
      await mineBlocks(VOTING_DELAY + 1);

      await governor.castVote(propId2, VoteType.For);
      await governor.connect(alice).castVote(propId2, VoteType.Against);

      const [againstVotes, forVotes, abstainVotes] = await governor.proposalVotes(propId2);
      expect(forVotes).to.be.gt(0n);
      expect(againstVotes).to.equal(aliceAmount);
      expect(abstainVotes).to.equal(0n);
    });

    it("should not allow voting twice on same proposal", async function () {
      await governor.castVote(proposalId, VoteType.For);
      await expect(
        governor.castVote(proposalId, VoteType.Against)
      ).to.be.revertedWithCustomError(governor, "GovernorAlreadyCastVote");
    });

    it("should not allow voting on non-Active proposal", async function () {
      // proposalId is Active, move past voting period to make it Succeeded
      await governor.castVote(proposalId, VoteType.For);
      await mineBlocks(VOTING_PERIOD + 1);
      expect(await governor.state(proposalId)).to.equal(ProposalState.Succeeded);

      // Alice tries to vote on Succeeded proposal
      await expect(
        governor.connect(alice).castVote(proposalId, VoteType.For)
      ).to.be.revertedWithCustomError(governor, "GovernorUnexpectedProposalState");
    });
  });

  describe("Proposal Cancellation", function () {
    it("should allow proposer to cancel a proposal", async function () {
      const targets = [await taxToken.getAddress()];
      const values = [0n];
      const calldatas = [
        taxToken.interface.encodeFunctionData("setBuyTax", [1000]),
      ];
      const description = "Proposal to cancel";
      const descriptionHash = ethers.id(description);

      const tx = await governor.propose(targets, values, calldatas, description);
      const proposalId = await getProposalId(tx);

      expect(await governor.state(proposalId)).to.equal(ProposalState.Pending);

      await governor.cancel(targets, values, calldatas, descriptionHash);
      expect(await governor.state(proposalId)).to.equal(ProposalState.Canceled);
    });
  });

  describe("Execution Timing", function () {
    it("should revert execute before timelock delay", async function () {
      const targets = [await taxToken.getAddress()];
      const values = [0n];
      const calldatas = [
        taxToken.interface.encodeFunctionData("setBuyTax", [1000]),
      ];
      const description = "Early execute test";
      const descriptionHash = ethers.id(description);

      const tx = await governor.propose(targets, values, calldatas, description);
      const proposalId = await getProposalId(tx);

      await mineBlocks(VOTING_DELAY + 1);
      await governor.castVote(proposalId, VoteType.For);
      await mineBlocks(VOTING_PERIOD + 1);

      // Queue it
      await governor.queue(targets, values, calldatas, descriptionHash);
      expect(await governor.state(proposalId)).to.equal(ProposalState.Queued);

      // Try to execute immediately (should fail - timelock delay not met)
      await expect(
        governor.execute(targets, values, calldatas, descriptionHash)
      ).to.be.reverted;
    });
  });

  describe("Proposal Threshold Enforcement", function () {
    it("should enforce proposal threshold when set", async function () {
      // Deploy a new governor with a high threshold
      const governorFactory = await ethers.getContractFactory("DAOGovernor");
      const strictGovernor = await governorFactory.deploy(
        await token.getAddress(),
        await timelock.getAddress(),
        VOTING_DELAY,
        VOTING_PERIOD,
        ethers.parseEther("100000"), // 100k token threshold
        QUORUM_PERCENTAGE
      );

      // Alice has no tokens, should not be able to propose
      const targets = [await taxToken.getAddress()];
      const values = [0n];
      const calldatas = [
        taxToken.interface.encodeFunctionData("setBuyTax", [1000]),
      ];

      await expect(
        strictGovernor.connect(alice).propose(targets, values, calldatas, "Should fail")
      ).to.be.revertedWithCustomError(strictGovernor, "GovernorInsufficientProposerVotes");
    });
  });

  describe("State Transitions", function () {
    it("should transition from Pending -> Active -> Succeeded -> Queued -> Executed", async function () {
      const targets = [await taxToken.getAddress()];
      const values = [0n];
      const calldatas = [
        taxToken.interface.encodeFunctionData("setBuyTax", [1000]),
      ];
      const description = "Set buy tax to 10%";
      const descriptionHash = ethers.id(description);

      // Propose
      const tx = await governor.propose(targets, values, calldatas, description);
      const proposalId = await getProposalId(tx);

      // Pending
      expect(await governor.state(proposalId)).to.equal(ProposalState.Pending);

      // Move to Active
      await mineBlocks(VOTING_DELAY + 1);
      expect(await governor.state(proposalId)).to.equal(ProposalState.Active);

      // Vote
      await governor.castVote(proposalId, VoteType.For);

      // Move past voting period
      await mineBlocks(VOTING_PERIOD + 1);
      expect(await governor.state(proposalId)).to.equal(ProposalState.Succeeded);

      // Queue
      await governor.queue(targets, values, calldatas, descriptionHash);
      expect(await governor.state(proposalId)).to.equal(ProposalState.Queued);

      // Wait for timelock delay
      await increaseTime(TIMELOCK_DELAY + 1);

      // Execute
      await governor.execute(targets, values, calldatas, descriptionHash);
      expect(await governor.state(proposalId)).to.equal(ProposalState.Executed);

      // Verify the tax was actually updated
      expect(await taxToken.buyTax()).to.equal(1000n);
    });
  });
});
