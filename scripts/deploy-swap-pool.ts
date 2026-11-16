import pkg from "hardhat";
const { ethers, run } = pkg;

// The pool is a constant-product AMM, not an EOA: it holds the ETH + ARIWA
// reserves and prices every trade against them. Deployer becomes owner (fee +
// withdraw). Seed liquidity sets the opening price.
const ARIWA_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS;

// Opening price used to derive the ARIWA seed when SWAP_POOL_TOKEN_FUNDING is
// not set. Small by default so a testnet faucet drip buys something.
const DEFAULT_TOKENS_PER_ETH = "10000";
// Swap fee in basis points (30 = 0.30%), capped on-chain at 500 (5%).
const DEFAULT_FEE_BPS = "30";
// Seed liquidity so the page isn't empty on first load. Empty string skips.
const DEFAULT_ETH_FUNDING = "0.05";
const DEFAULT_TOKEN_FUNDING = "500";

function parseAmount(raw: string | undefined, fallback: string, label: string): bigint {
  const value = raw === undefined ? fallback : raw.trim();
  if (value === "") return 0n;
  try {
    return ethers.parseEther(value);
  } catch {
    throw new Error(`${label} must be a decimal amount, got "${value}"`);
  }
}

async function main() {
  if (!ARIWA_TOKEN_ADDRESS || !ethers.isAddress(ARIWA_TOKEN_ADDRESS)) {
    throw new Error(
      "Set NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS in .env.local to the deployed AriwaToken address",
    );
  }

  const tokensPerEth = parseAmount(
    process.env.SWAP_POOL_TOKENS_PER_ETH,
    DEFAULT_TOKENS_PER_ETH,
    "SWAP_POOL_TOKENS_PER_ETH",
  );
  if (tokensPerEth === 0n) {
    throw new Error("SWAP_POOL_TOKENS_PER_ETH must be greater than zero");
  }

  const feeBpsRaw = process.env.SWAP_POOL_FEE_BPS ?? DEFAULT_FEE_BPS;
  const feeBps = Number(feeBpsRaw);
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 500) {
    throw new Error(
      `SWAP_POOL_FEE_BPS must be a whole number from 0 to 500, got "${feeBpsRaw}"`,
    );
  }

  const ethFunding = parseAmount(
    process.env.SWAP_POOL_ETH_FUNDING,
    DEFAULT_ETH_FUNDING,
    "SWAP_POOL_ETH_FUNDING",
  );
  // Without an explicit token amount, seed at the requested opening price.
  const tokenFunding =
    process.env.SWAP_POOL_TOKEN_FUNDING === undefined
      ? (ethFunding * tokensPerEth) / ethers.WeiPerEther
      : parseAmount(
          process.env.SWAP_POOL_TOKEN_FUNDING,
          DEFAULT_TOKEN_FUNDING,
          "SWAP_POOL_TOKEN_FUNDING",
        );

  const [deployer] = await ethers.getSigners();
  console.log("===================================================");
  console.log("  AriwaSwapPool Deployment (GIWA Sepolia)");
  console.log("===================================================");
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH",
  );
  console.log("AriwaToken:", ARIWA_TOKEN_ADDRESS);
  console.log("Swap fee:", (feeBps / 100).toFixed(2) + "%");
  console.log(
    "Opening price:",
    ethers.formatEther(
      tokenFunding > 0n && ethFunding > 0n
        ? (tokenFunding * ethers.WeiPerEther) / ethFunding
        : tokensPerEth,
    ),
    "ARIWA per 1 ETH",
  );
  console.log("Seed ETH:", ethers.formatEther(ethFunding));
  console.log("Seed ARIWA:", ethers.formatEther(tokenFunding));
  console.log("");

  console.log("Deploying AriwaSwapPool...");
  const AriwaSwapPool = await ethers.getContractFactory("AriwaSwapPool");
  const pool = await AriwaSwapPool.deploy(ARIWA_TOKEN_ADDRESS, feeBps);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log(`AriwaSwapPool deployed to: ${poolAddress}`);

  // ─── Seed liquidity ────────────────────────────────────────────────
  if (ethFunding > 0n || tokenFunding > 0n) {
    console.log("\nSeeding liquidity...");
    try {
      if (tokenFunding > 0n) {
        const token = await ethers.getContractAt("AriwaToken", ARIWA_TOKEN_ADDRESS);
        const held: bigint = await token.balanceOf(deployer.address);

        if (held < tokenFunding) {
          const shortfall = tokenFunding - held;
          console.log(
            `Deployer holds ${ethers.formatEther(held)} ARIWA; minting ${ethers.formatEther(shortfall)}...`,
          );
          try {
            const tx = await token.mint(deployer.address, shortfall);
            await tx.wait();
            console.log("Minted. New balance:", ethers.formatEther(await token.balanceOf(deployer.address)));
          } catch (error) {
            console.warn(
              "Could not mint ARIWA (deployer is not the token owner?). " +
                "Send tokens to the deployer and re-run the seed with SWAP_POOL_TOKEN_FUNDING.",
              error instanceof Error ? error.message : error,
            );
          }
        }

        const balanceAfter: bigint = await token.balanceOf(deployer.address);
        const fundable = balanceAfter < tokenFunding ? balanceAfter : tokenFunding;

        if (fundable > 0n) {
          console.log(`Approving ${ethers.formatEther(fundable)} ARIWA...`);
          const approveTx = await token.approve(poolAddress, fundable);
          await approveTx.wait();
        } else {
          console.warn("No ARIWA available to seed the pool.");
        }

        const actualTokenFunding = fundable;
        console.log(
          `Adding liquidity: ${ethers.formatEther(ethFunding)} ETH + ${ethers.formatEther(actualTokenFunding)} ARIWA...`,
        );
        const addTx = await pool.addLiquidity(actualTokenFunding, { value: ethFunding });
        await addTx.wait();
      } else {
        console.log(`Adding liquidity: ${ethers.formatEther(ethFunding)} ETH...`);
        const addTx = await pool.addLiquidity(0n, { value: ethFunding });
        await addTx.wait();
      }

      console.log("Liquidity added.");
      console.log(
        "Pool reserves:",
        ethers.formatEther(await ethers.provider.getBalance(poolAddress)),
        "ETH /",
        ethers.formatEther(
          await (await ethers.getContractAt("AriwaToken", ARIWA_TOKEN_ADDRESS)).balanceOf(
            poolAddress,
          ),
        ),
        "ARIWA",
      );
    } catch (error) {
      console.warn(
        "Liquidity seeding failed. The pool is deployed; fund it later with addLiquidity().",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Wait for explorer to index
  console.log("\nWaiting 30s for explorer to index...");
  await new Promise((resolve) => setTimeout(resolve, 30_000));

  // Verify
  console.log(`\nVerifying ${poolAddress} on GIWA Explorer...`);
  try {
    await run("verify:verify", {
      address: poolAddress,
      constructorArguments: [ARIWA_TOKEN_ADDRESS, feeBps],
    });
    console.log("AriwaSwapPool verified!");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("already verified")) {
      console.log("AriwaSwapPool is already verified.");
    } else {
      console.error("Verification failed:", msg);
    }
  }

  console.log("\n===================================================");
  console.log("  Deployment Complete!");
  console.log("===================================================");
  console.log(`AriwaSwapPool: ${poolAddress}`);
  console.log(`\nUpdate your .env.local:`);
  console.log(`NEXT_PUBLIC_SWAP_POOL_ADDRESS=${poolAddress}`);
  console.log(`\nGIWA Explorer:`);
  console.log(`https://sepolia-explorer.giwa.io/address/${poolAddress}#code`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
