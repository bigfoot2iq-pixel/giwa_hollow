import pkg from "hardhat";
const { ethers } = pkg;

/**
 * Moves the entire ARIWA supply into the swap pool.
 *
 *   1. Mints every unminted token to the token owner (`ownerWithdraw`).
 *   2. Transfers the owner's whole ARIWA balance to the pool contract.
 *
 * That leaves no ARIWA on the token contract and makes the pool the only place
 * where users can get ARIWA — which is exactly what the launchpad needs now that
 * mints are paid in ARIWA.
 *
 * Env:
 *   NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS — deployed AriwaToken
 *   NEXT_PUBLIC_SWAP_POOL_ADDRESS    — deployed AriwaSwapPool
 *   DEPLOYER_PRIVATE_KEY             — must be the AriwaToken owner
 *
 * Run:
 *   npx hardhat run scripts/fund-pool-with-ariwa.ts --network giwaSepolia
 */

const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS;
const POOL_ADDRESS = process.env.NEXT_PUBLIC_SWAP_POOL_ADDRESS;

async function main() {
  if (!TOKEN_ADDRESS || !ethers.isAddress(TOKEN_ADDRESS)) {
    throw new Error(
      "Set NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS to the deployed AriwaToken address"
    );
  }
  if (!POOL_ADDRESS || !ethers.isAddress(POOL_ADDRESS)) {
    throw new Error(
      "Set NEXT_PUBLIC_SWAP_POOL_ADDRESS to the deployed AriwaSwapPool address"
    );
  }

  const [signer] = await ethers.getSigners();
  const token = await ethers.getContractAt("AriwaToken", TOKEN_ADDRESS);

  const tokenOwner = await token.owner();
  if (tokenOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `The signer (${signer.address}) is not the AriwaToken owner (${tokenOwner}). ` +
        "Run this with the owner wallet's DEPLOYER_PRIVATE_KEY."
    );
  }

  const maxSupply = (await token.MAX_SUPPLY()) as bigint;
  const totalSupply = (await token.totalSupply()) as bigint;
  const unminted = maxSupply > totalSupply ? maxSupply - totalSupply : 0n;

  console.log("===================================================");
  console.log("  ARIWA → pool funding");
  console.log("===================================================");
  console.log("Signer:", signer.address);
  console.log("Token:", TOKEN_ADDRESS);
  console.log("Pool:", POOL_ADDRESS);
  console.log("Total supply:", ethers.formatEther(totalSupply), "/", ethers.formatEther(maxSupply), "ARIWA");
  console.log("Unminted:", ethers.formatEther(unminted), "ARIWA");
  console.log("");

  if (unminted > 0n) {
    console.log(`Claiming the remaining ${ethers.formatEther(unminted)} ARIWA...`);
    const balanceBefore = (await token.balanceOf(signer.address)) as bigint;
    const tx = await token.ownerWithdraw(unminted);
    await tx.wait();
    console.log("  Minted to the owner.");

    // GIWA's RPC can serve a stale balance for a few seconds right after the
    // mint confirms. Wait until the balance reflects the new supply before
    // deciding how much to move, otherwise a chunk is left behind.
    const expected = balanceBefore + unminted;
    let observed = (await token.balanceOf(signer.address)) as bigint;
    for (let attempt = 0; attempt < 15 && observed < expected; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      observed = (await token.balanceOf(signer.address)) as bigint;
    }

    if (observed < expected) {
      console.warn(
        `  Balance still reads ${ethers.formatEther(observed)} ARIWA; ` +
          `expected at least ${ethers.formatEther(expected)}. ` +
          "Re-run this script after the RPC catches up."
      );
    }
  } else {
    console.log("No unminted supply left — every token already exists.");
  }

  const poolBalanceBefore = (await token.balanceOf(POOL_ADDRESS)) as bigint;

  const ownerBalance = (await token.balanceOf(signer.address)) as bigint;
  if (ownerBalance > 0n) {
    console.log(`Sending ${ethers.formatEther(ownerBalance)} ARIWA to the pool...`);
    const tx = await token.transfer(POOL_ADDRESS, ownerBalance);
    await tx.wait();
    console.log("  Transfer confirmed.");
  } else {
    console.log("The owner holds no ARIWA — nothing to send.");
  }

  // Same RPC lag guard for the pool side, so the readout below reflects the
  // transfer instead of the pre-transfer reserve.
  const expectedPool = poolBalanceBefore + ownerBalance;
  let poolBalance = (await token.balanceOf(POOL_ADDRESS)) as bigint;
  for (let attempt = 0; attempt < 15 && poolBalance < expectedPool; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    poolBalance = (await token.balanceOf(POOL_ADDRESS)) as bigint;
  }

  const [tokenBalance, finalSupply, poolEth] = await Promise.all([
    token.balanceOf(TOKEN_ADDRESS) as Promise<bigint>,
    token.totalSupply() as Promise<bigint>,
    ethers.provider.getBalance(POOL_ADDRESS) as Promise<bigint>,
  ]);

  console.log("");
  console.log("───────────────────────────────────────────────────");
  console.log("Pool ETH balance:", ethers.formatEther(poolEth));
  console.log("Pool ARIWA balance:", ethers.formatEther(poolBalance));
  console.log("Token-contract ARIWA:", ethers.formatEther(tokenBalance));
  console.log("Total supply:", ethers.formatEther(finalSupply), "/", ethers.formatEther(maxSupply));
  if (poolEth > 0n && poolBalance > 0n) {
    console.log(
      "Implied price:",
      ethers.formatEther((poolEth * ethers.WeiPerEther) / poolBalance),
      "ETH per ARIWA"
    );
  }
  console.log("───────────────────────────────────────────────────");

  if (finalSupply === maxSupply) {
    console.log(
      "The full supply is minted. `claimTokens` can no longer mint anything; " +
        "the pool is the only ARIWA source."
    );
  }

  if (tokenBalance > 0n) {
    console.warn(
      "WARNING: the AriwaToken contract itself holds ARIWA. AriwaToken has no " +
        "rescue function, so those tokens are stuck unless the token is redeployed."
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
