import { ethers, network } from "hardhat";

/// Mine a given number of blocks on the Hardhat network
export async function mineBlocks(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await network.provider.send("evm_mine");
  }
}

/// Increase time by `seconds` and mine one block
export async function increaseTime(seconds: number): Promise<void> {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

/// Governor ProposalState enum (mirrors OpenZeppelin)
export enum ProposalState {
  Pending = 0,
  Active = 1,
  Canceled = 2,
  Defeated = 3,
  Succeeded = 4,
  Queued = 5,
  Expired = 6,
  Executed = 7,
}

/// VoteType enum for GovernorCountingSimple
export enum VoteType {
  Against = 0,
  For = 1,
  Abstain = 2,
}

/// Simulate a buy from an AMM pair (transfer from pair to buyer)
export async function simulateBuy(
  token: { connect: (signer: any) => { transfer: (to: string, amount: bigint) => Promise<any> } },
  pairSigner: any,
  buyer: string,
  amount: bigint
): Promise<any> {
  return token.connect(pairSigner).transfer(buyer, amount);
}

/// Simulate a sell to an AMM pair (transfer from seller to pair)
export async function simulateSell(
  token: { connect: (signer: any) => { transfer: (to: string, amount: bigint) => Promise<any> } },
  sellerSigner: any,
  pairAddress: string,
  amount: bigint
): Promise<any> {
  return token.connect(sellerSigner).transfer(pairAddress, amount);
}
