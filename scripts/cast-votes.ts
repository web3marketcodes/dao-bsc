import { ethers } from "hardhat";
import "dotenv/config";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Casting votes with:", deployer.address);

  const governor = await ethers.getContractAt("DAOGovernor", process.env.DAO_GOVERNOR_ADDRESS!);

  const proposals = [
    { id: "85061844737959885604743049358638310976938126530554911261037506966883151012227", name: "Reduce Buy Tax to 3%", vote: 1 },
    { id: "45364417046943565251203991859705050044126459386091518916047896453936124989060", name: "Update Revenue Split", vote: 1 },
    { id: "24933938808934080374339581520714041317677094952275462335414141914951043377936", name: "Reduce Lock Period", vote: 0 },
    { id: "82833323339561763551851989930414043013212408813418260908921905141869134053144", name: "Enable Trading", vote: 1 },
  ];

  for (const p of proposals) {
    // Check if already voted
    const hasVoted = await governor.hasVoted(p.id, deployer.address);
    if (hasVoted) {
      console.log(`Already voted on: ${p.name} — skipping`);
      continue;
    }

    const state = await governor.state(p.id);
    console.log(`Proposal "${p.name}" state: ${state}`);

    if (state !== 1n) { // 1 = Active
      console.log(`  Not in Active state, skipping`);
      continue;
    }

    const voteLabel = p.vote === 1 ? "FOR" : p.vote === 0 ? "AGAINST" : "ABSTAIN";
    console.log(`  Voting ${voteLabel}...`);
    const tx = await governor.castVote(p.id, p.vote);
    await tx.wait();
    console.log(`  Vote cast!`);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("All votes cast successfully!");
  console.log("═══════════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
