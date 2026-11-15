import { expect } from "chai";
import pkg from "hardhat";

const { ethers } = pkg;

const RATE = ethers.parseEther("10000");

async function deployFixture() {
  const [owner, trader, other] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("AriwaToken");
  const token = await Token.deploy("ARIWA", "ARIWA", ethers.parseEther("1"), 0n, 43_200);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  const Pool = await ethers.getContractFactory("AriwaSwapPool");
  const pool = await Pool.deploy(tokenAddress, RATE);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();

  // Seed: 0.05 ETH + 500 ARIWA (equal value at the 10,000 ARIWA/ETH rate).
  await token.mint(owner.address, ethers.parseEther("500"));
  await token.approve(poolAddress, ethers.parseEther("500"));
  await pool.addLiquidity(ethers.parseEther("500"), {
    value: ethers.parseEther("0.05"),
  });

  // Give the trader 10 ARIWA and approve the pool for the sell path.
  await token.mint(trader.address, ethers.parseEther("10"));
  await token.connect(trader).approve(poolAddress, ethers.parseEther("10"));

  return { owner, trader, other, token, pool };
}

describe("AriwaSwapPool", () => {
  it("buys ARIWA at the fixed rate", async () => {
    const { trader, token, pool } = await deployFixture();
    const ethIn = ethers.parseEther("0.001");
    const expectedTokens = ethers.parseEther("10");
    const before = await token.balanceOf(trader.address);

    await expect(pool.connect(trader).buyTokens(expectedTokens, { value: ethIn }))
      .to.emit(pool, "TokensPurchased")
      .withArgs(trader.address, ethIn, expectedTokens);

    expect(await token.balanceOf(trader.address)).to.equal(before + expectedTokens);
  });

  it("rejects buys that fall below the slippage guard", async () => {
    const { trader, pool } = await deployFixture();
    const ethIn = ethers.parseEther("0.001");
    const expectedTokens = ethers.parseEther("10");

    await expect(
      pool.connect(trader).buyTokens(expectedTokens + 1n, { value: ethIn }),
    ).to.be.revertedWith("Slippage exceeded");
  });

  it("rejects buys larger than the token reserve", async () => {
    const { trader, pool } = await deployFixture();
    const ethIn = ethers.parseEther("1");

    await expect(pool.connect(trader).buyTokens(0n, { value: ethIn })).to.be.revertedWith(
      "Insufficient token liquidity",
    );
  });

  it("sells ARIWA at the fixed rate", async () => {
    const { trader, token, pool } = await deployFixture();
    const tokensIn = ethers.parseEther("10");
    const expectedEth = ethers.parseEther("0.001");

    const before = await ethers.provider.getBalance(trader.address);
    const tx = await pool.connect(trader).sellTokens(tokensIn, expectedEth);
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    expect(await ethers.provider.getBalance(trader.address)).to.equal(
      before + expectedEth - gasCost,
    );
    expect(await token.balanceOf(trader.address)).to.equal(0n);
  });

  it("rejects sells that fall below the slippage guard", async () => {
    const { trader, pool } = await deployFixture();
    const tokensIn = ethers.parseEther("10");
    const expectedEth = ethers.parseEther("0.001");

    await expect(
      pool.connect(trader).sellTokens(tokensIn, expectedEth + 1n),
    ).to.be.revertedWith("Slippage exceeded");
  });

  it("only lets the owner change the rate and withdraw reserves", async () => {
    const { owner, other, pool } = await deployFixture();

    await expect(pool.connect(other).setRate(RATE)).to.be.revertedWithCustomError(
      pool,
      "OwnableUnauthorizedAccount",
    );
    await expect(
      pool.connect(other).withdrawEth(other.address, 1n),
    ).to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");

    await pool.connect(owner).setRate(ethers.parseEther("20000"));
    expect(await pool.tokensPerEth()).to.equal(ethers.parseEther("20000"));
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
