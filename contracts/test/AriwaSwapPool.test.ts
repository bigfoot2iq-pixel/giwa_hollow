import { expect } from "chai";
import pkg from "hardhat";

const { ethers } = pkg;

const FEE_BPS = 30n;
const SEED_ETH = ethers.parseEther("0.05");
const SEED_TOKENS = ethers.parseEther("500");

async function deployFixture() {
  const [owner, trader, other] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("AriwaToken");
  const token = await Token.deploy(
    "ARIWA",
    "ARIWA",
    ethers.parseEther("1"),
    0n,
    43_200,
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  const Pool = await ethers.getContractFactory("AriwaSwapPool");
  const pool = await Pool.deploy(tokenAddress, FEE_BPS);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();

  // Seed: 0.05 ETH + 500 ARIWA, so the opening price is 10,000 ARIWA per ETH.
  await token.mint(owner.address, SEED_TOKENS);
  await token.approve(poolAddress, SEED_TOKENS);
  await pool.addLiquidity(SEED_TOKENS, { value: SEED_ETH });

  // Give the trader 10 ARIWA and approve the pool for the sell path.
  await token.mint(trader.address, ethers.parseEther("10"));
  await token.connect(trader).approve(poolAddress, ethers.parseEther("10"));

  return { owner, trader, other, token, pool, poolAddress };
}

describe("AriwaSwapPool", () => {
  it("seeds both assets and derives the opening price", async () => {
    const { pool } = await deployFixture();

    const [ethReserve, tokenReserve] = await pool.getReserves();
    expect(ethReserve).to.equal(SEED_ETH);
    expect(tokenReserve).to.equal(SEED_TOKENS);
    expect(await pool.tokensPerEth()).to.equal(ethers.parseEther("10000"));
    expect(await pool.spotPrice()).to.equal(ethers.parseEther("0.0001"));

    const state = await pool.getPoolState();
    expect(state.ethReserve).to.equal(SEED_ETH);
    expect(state.tokenReserve).to.equal(SEED_TOKENS);
    expect(state.tokensPerEth_).to.equal(ethers.parseEther("10000"));
    expect(state.feeBps_).to.equal(FEE_BPS);
  });

  it("requires both assets for the first deposit", async () => {
    const { owner, token } = await deployFixture();
    const Pool = await ethers.getContractFactory("AriwaSwapPool");
    const fresh = await Pool.deploy(await token.getAddress(), FEE_BPS);
    await fresh.waitForDeployment();

    await expect(
      fresh.connect(owner).addLiquidity(0n, { value: ethers.parseEther("0.01") }),
    ).to.be.revertedWith("Seed both assets");

    await token.mint(owner.address, ethers.parseEther("100"));
    await token.approve(await fresh.getAddress(), ethers.parseEther("100"));
    await expect(
      fresh.connect(owner).addLiquidity(ethers.parseEther("100")),
    ).to.be.revertedWith("Seed both assets");
  });

  it("buys ARIWA at the curve quote", async () => {
    const { trader, token, pool } = await deployFixture();
    const ethIn = ethers.parseEther("0.001");
    const quoted = await pool.quoteBuy(ethIn);
    const before = await token.balanceOf(trader.address);

    await expect(pool.connect(trader).buyTokens(quoted, { value: ethIn })).to.emit(
      pool,
      "TokensPurchased",
    );

    expect(await token.balanceOf(trader.address)).to.equal(before + quoted);
    expect(quoted).to.be.greaterThan(0n);
    // Less than the fixed-rate amount (10 ARIWA): the curve and fee apply.
    expect(quoted).to.be.lessThan(ethers.parseEther("10"));
  });

  it("only requires enough slippage room, not a fixed rate", async () => {
    const { trader, pool } = await deployFixture();
    const ethIn = ethers.parseEther("0.001");
    const quoted = await pool.quoteBuy(ethIn);

    await expect(
      pool.connect(trader).buyTokens(quoted + 1n, { value: ethIn }),
    ).to.be.revertedWith("Slippage exceeded");

    await expect(
      pool.connect(trader).buyTokens(quoted, { value: ethIn }),
    ).to.emit(pool, "TokensPurchased");
  });

  it("moves the price up after a buy and down after a sell", async () => {
    const { trader, pool } = await deployFixture();
    const priceBefore = await pool.spotPrice();
    const rateBefore = await pool.tokensPerEth();

    await pool
      .connect(trader)
      .buyTokens(0n, { value: ethers.parseEther("0.005") });

    const priceAfterBuy = await pool.spotPrice();
    const rateAfterBuy = await pool.tokensPerEth();
    expect(priceAfterBuy).to.be.greaterThan(priceBefore);
    expect(rateAfterBuy).to.be.lessThan(rateBefore);

    await pool.connect(trader).sellTokens(ethers.parseEther("5"), 0n);

    expect(await pool.spotPrice()).to.be.lessThan(priceAfterBuy);
    expect(await pool.tokensPerEth()).to.be.greaterThan(rateAfterBuy);
  });

  it("keeps the fee in the reserves, growing k on every swap", async () => {
    const { trader, pool } = await deployFixture();
    const [ethBefore, tokenBefore] = await pool.getReserves();
    const kBefore = ethBefore * tokenBefore;

    await pool
      .connect(trader)
      .buyTokens(0n, { value: ethers.parseEther("0.001") });

    const [ethAfter, tokenAfter] = await pool.getReserves();
    expect(ethAfter * tokenAfter).to.be.greaterThan(kBefore);
    // Fees stay in the pool instead of being paid to the owner.
    expect(tokenAfter).to.be.lessThan(tokenBefore);
    expect(ethAfter).to.equal(ethBefore + ethers.parseEther("0.001"));
  });

  it("sells ARIWA at the curve quote", async () => {
    const { trader, token, pool } = await deployFixture();
    const tokensIn = ethers.parseEther("10");
    const quoted = await pool.quoteSell(tokensIn);

    const before = await ethers.provider.getBalance(trader.address);
    const tx = await pool.connect(trader).sellTokens(tokensIn, quoted);
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    expect(await ethers.provider.getBalance(trader.address)).to.equal(
      before + quoted - gasCost,
    );
    expect(await token.balanceOf(trader.address)).to.equal(0n);
  });

  it("rejects sells that fall below the slippage guard", async () => {
    const { trader, pool } = await deployFixture();
    const tokensIn = ethers.parseEther("10");
    const quoted = await pool.quoteSell(tokensIn);

    await expect(
      pool.connect(trader).sellTokens(tokensIn, quoted + 1n),
    ).to.be.revertedWith("Slippage exceeded");
  });

  it("records price history only when the price changes", async () => {
    const { owner, trader, token, pool, poolAddress } = await deployFixture();

    expect(await pool.pricePointCount()).to.equal(1n);
    let history = await pool.getPriceHistory();
    expect(history.length).to.equal(1);
    expect(history[0].tokensPerEth).to.equal(ethers.parseEther("10000"));

    // A proportional deposit leaves the price untouched.
    await token.mint(owner.address, ethers.parseEther("100"));
    await token.approve(poolAddress, ethers.parseEther("100"));
    await pool
      .connect(owner)
      .addLiquidity(ethers.parseEther("100"), { value: ethers.parseEther("0.01") });
    expect(await pool.pricePointCount()).to.equal(1n);

    await pool
      .connect(trader)
      .buyTokens(0n, { value: ethers.parseEther("0.001") });
    expect(await pool.pricePointCount()).to.equal(2n);

    await pool.connect(trader).sellTokens(ethers.parseEther("5"), 0n);
    expect(await pool.pricePointCount()).to.equal(3n);

    history = await pool.getPriceHistory();
    expect(history.length).to.equal(3);
    expect(history[2].tokensPerEth).to.equal(await pool.tokensPerEth());
    expect(history[2].timestamp).to.be.greaterThan(0n);
    // Oldest first.
    expect(history[2].timestamp).to.be.greaterThanOrEqual(history[1].timestamp);
  });

  it("caps the fee and keeps fee changes owner-only", async () => {
    const { owner, other, pool } = await deployFixture();

    await expect(pool.connect(other).setFee(100n)).to.be.revertedWithCustomError(
      pool,
      "OwnableUnauthorizedAccount",
    );
    await expect(pool.connect(owner).setFee(501n)).to.be.revertedWith(
      "Fee too high",
    );

    await expect(pool.connect(owner).setFee(100n))
      .to.emit(pool, "FeeUpdated")
      .withArgs(FEE_BPS, 100n);
    expect(await pool.feeBps()).to.equal(100n);

    // A higher fee lowers the quoted output.
    const tokensWithHighFee = await pool.quoteBuy(ethers.parseEther("0.001"));
    await pool.connect(owner).setFee(0n);
    const tokensWithNoFee = await pool.quoteBuy(ethers.parseEther("0.001"));
    expect(tokensWithNoFee).to.be.greaterThan(tokensWithHighFee);
  });

  it("only lets the owner withdraw reserves", async () => {
    const { owner, other, pool } = await deployFixture();

    await expect(
      pool.connect(other).withdrawEth(other.address, 1n),
    ).to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");
    await expect(
      pool.connect(other).withdrawTokens(other.address, 1n),
    ).to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");

    await pool.connect(owner).withdrawEth(owner.address, ethers.parseEther("0.01"));
    const [ethReserve] = await pool.getReserves();
    expect(ethReserve).to.equal(ethers.parseEther("0.04"));
  });

  it("pauses trading", async () => {
    const { owner, trader, pool } = await deployFixture();

    await pool.connect(owner).pause();
    await expect(
      pool.connect(trader).buyTokens(0n, { value: ethers.parseEther("0.001") }),
    ).to.be.revertedWithCustomError(pool, "EnforcedPause");

    await pool.connect(owner).unpause();
    await expect(
      pool.connect(trader).buyTokens(0n, { value: ethers.parseEther("0.001") }),
    ).to.emit(pool, "TokensPurchased");
  });
});
