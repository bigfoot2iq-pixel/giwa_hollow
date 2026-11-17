import pkg from "hardhat";
const { ethers } = pkg;

/**
 * Deploys the AriwaNFT collection (ERC721A) — the same contract logic as the
 * Elyziuma launchpad collection, with the ARIWA name and metadata.
 *
 * The contract hard-codes:
 *   - MAX_SUPPLY = 2222 (immutable)
 *   - maxPerWallet starts at 1 (owner-controlled afterwards)
 *   - publicMintOpen starts closed (the owner opens it from /admin)
 *   - public mints are paid in ARIWA (owner can switch the payment asset)
 *
 * Constructor: (address initialOwner, string baseURI)
 *
 * Env:
 *   NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS / LAUNCHPAD_PAYMENT_TOKEN — ARIWA address
 *   LAUNCHPAD_MINT_PRICE — price per NFT in ARIWA (default 1)
 *   LAUNCHPAD_MAX_PER_WALLET — per-wallet cap (default 1)
 *   LAUNCHPAD_MINT_OPEN — open the public phase on deploy (default false)
 */

const BASE_URI = process.env.LAUNCHPAD_BASE_URI || "";
if (BASE_URI && !BASE_URI.endsWith("/")) {
  throw new Error(
    "LAUNCHPAD_BASE_URI must end with '/' because the contract appends `${tokenId}.json`"
  );
}

const PAYMENT_TOKEN =
  process.env.LAUNCHPAD_PAYMENT_TOKEN ||
  process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS ||
  "";
if (!PAYMENT_TOKEN || !ethers.isAddress(PAYMENT_TOKEN)) {
  throw new Error(
    "Set NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS (or LAUNCHPAD_PAYMENT_TOKEN) to the deployed ARIWA token address"
  );
}

// The mint is priced per NFT in ARIWA. One ARIWA per piece is the default.
const PUBLIC_PRICE = ethers.parseEther(process.env.LAUNCHPAD_MINT_PRICE || "1");
const MAX_PER_WALLET = BigInt(process.env.LAUNCHPAD_MAX_PER_WALLET || "1");
const MINT_OPEN =
  (process.env.LAUNCHPAD_MINT_OPEN || "false").toLowerCase() === "true";

async function main() {
  const [deployer] = await ethers.getSigners();

  const owner =
    process.env.LAUNCHPAD_NFT_OWNER ||
    process.env.NEXT_PUBLIC_ADMIN_WALLET ||
    deployer.address;

  console.log("═══════════════════════════════════════════════════");
  console.log("  AriwaNFT Deployment (GIWA Sepolia)");
  console.log("═══════════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );
  console.log("Name: ARIWA Genesis (hard-coded)");
  console.log("Symbol: ARIGEN (hard-coded)");
  console.log("Max supply: 2222 (immutable)");
  console.log("Owner:", owner);
  console.log("Base URI:", BASE_URI || "(not set — owner can set later)");
  console.log("Payment token:", PAYMENT_TOKEN, "(ARIWA)");
  console.log("Public price:", ethers.formatEther(PUBLIC_PRICE), "ARIWA");
  console.log("Max per wallet:", MAX_PER_WALLET.toString());
  console.log("Public mint open:", MINT_OPEN);
  console.log("");

  console.log("Deploying AriwaNFT...");
  const factory = await ethers.getContractFactory("AriwaNFT");
  // Deploy with the deployer as the temporary owner so this script can set the
  // initial price/phase. Ownership is handed to the configured owner at the end;
  // that wallet signs the /admin launchpad writes.
  const contract = await factory.deploy(deployer.address, BASE_URI);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`AriwaNFT deployed to: ${address}`);

  console.log("\nConfiguring the collection...");
  const paymentTx = await contract.setPaymentToken(PAYMENT_TOKEN);
  await paymentTx.wait();
  console.log(`  paymentToken = ${PAYMENT_TOKEN} (ARIWA)`);

  if (PUBLIC_PRICE > 0n) {
    const tx = await contract.setPublicPrice(PUBLIC_PRICE);
    await tx.wait();
    console.log(`  publicPrice = ${ethers.formatEther(PUBLIC_PRICE)} ARIWA`);
  }

  if (MAX_PER_WALLET !== 1n) {
    const tx = await contract.setMaxPerWallet(MAX_PER_WALLET);
    await tx.wait();
    console.log(`  maxPerWallet = ${MAX_PER_WALLET.toString()}`);
  }

  if (MINT_OPEN) {
    const tx = await contract.setPublicMintOpen(true);
    await tx.wait();
    console.log("  publicMintOpen = true");
  }

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    const tx = await contract.transferOwnership(owner);
    await tx.wait();
    console.log(`  ownership transferred to ${owner}`);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Deployment Complete (left unverified)");
  console.log("═══════════════════════════════════════════════════");
  console.log(`AriwaNFT: ${address}`);
  console.log(`\nUpdate your .env.local:`);
  console.log(`NEXT_PUBLIC_LAUNCHPAD_NFT_ADDRESS=${address}`);
  console.log(`\nThen move the ARIWA supply into the pool so minters can buy it:`);
  console.log(
    "npx hardhat run scripts/fund-pool-with-ariwa.ts --network giwaSepolia"
  );
  console.log(`\nGIWA Explorer:`);
  console.log(`https://sepolia-explorer.giwa.io/address/${address}#code`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
