import { expect } from "chai";
import pkg from "hardhat";

const { ethers } = pkg;

const ONE = ethers.parseEther("1");
const BASE_URI = "https://example.test/metadata/";

async function deployFixture() {
  const [owner, minter, other] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("AriwaToken");
  const token = await Token.deploy("ARIWA", "ARIWA", ONE, 0n, 0);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  const NFT = await ethers.getContractFactory("AriwaNFT");
  const nft = await NFT.deploy(owner.address, BASE_URI);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();

  return { owner, minter, other, token, tokenAddress, nft, nftAddress };
}

/** Switch the collection to ARIWA payments at 1 ARIWA per NFT. */
async function openAriwaMint(
  fixture: Awaited<ReturnType<typeof deployFixture>>
) {
  const { nft, tokenAddress } = fixture;
  await nft.setPaymentToken(tokenAddress);
  await nft.setPublicPrice(ONE);
  await nft.setPublicMintOpen(true);
}
describe("AriwaNFT", () => {
  it("starts with a per-wallet cap of 1 and the native-currency payment", async () => {
    const { nft } = await deployFixture();

    expect(await nft.maxPerWallet()).to.equal(1n);
    expect(await nft.publicMintOpen()).to.equal(false);
    expect(await nft.paymentToken()).to.equal(ethers.ZeroAddress);
    expect(await nft.maxSupply()).to.equal(2222n);
    expect(await nft.publicPrice()).to.equal(0n);
  });

  it("mints with ARIWA and pulls the per-NFT price from the minter", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, token, minter } = fixture;

    await token.mint(minter.address, ONE * 2n);
    await openAriwaMint(fixture);
    await token.connect(minter).approve(nftAddress, ONE);

    await expect(nft.connect(minter).publicMint(1))
      .to.emit(nft, "PublicMinted")
      .withArgs(minter.address, 1n);

    expect(await nft.ownerOf(1)).to.equal(minter.address);
    expect(await nft.minted(minter.address)).to.equal(1n);
    expect(await token.balanceOf(nftAddress)).to.equal(ONE);
    expect(await token.balanceOf(minter.address)).to.equal(ONE);
  });

  it("multiplies the configured price by the requested quantity", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, token, minter } = fixture;

    await token.mint(minter.address, ONE * 5n);
    await openAriwaMint(fixture);
    await nft.setMaxPerWallet(3);
    await token.connect(minter).approve(nftAddress, ONE * 3n);

    await nft.connect(minter).publicMint(3);

    expect(await nft.minted(minter.address)).to.equal(3n);
    expect(await token.balanceOf(nftAddress)).to.equal(ONE * 3n);
    expect(await token.balanceOf(minter.address)).to.equal(ONE * 2n);
  });

  it("rejects a mint without an ARIWA allowance", async () => {
    const fixture = await deployFixture();
    const { nft, token, minter } = fixture;

    await token.mint(minter.address, ONE);
    await openAriwaMint(fixture);

    await expect(nft.connect(minter).publicMint(1)).to.be.reverted;
  });

  it("rejects a mint when the wallet cannot cover the price", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, token, minter } = fixture;

    await token.mint(minter.address, ONE / 2n);
    await openAriwaMint(fixture);
    await token.connect(minter).approve(nftAddress, ONE);

    await expect(nft.connect(minter).publicMint(1)).to.be.revertedWithCustomError(
      nft,
      "InsufficientTokenBalance"
    );
  });

  it("rejects ETH sent while the payment token is an ERC20", async () => {
    const fixture = await deployFixture();
    const { nft, token, minter } = fixture;

    await token.mint(minter.address, ONE);
    await openAriwaMint(fixture);

    await expect(
      nft.connect(minter).publicMint(1, { value: ONE })
    ).to.be.revertedWithCustomError(nft, "WrongPayment");
  });

  it("still supports native ETH when the payment token is the zero address", async () => {
    const { nft, nftAddress, minter } = await deployFixture();

    await nft.setPublicPrice(ethers.parseEther("0.1"));
    await nft.setPublicMintOpen(true);

    await nft.connect(minter).publicMint(1, { value: ethers.parseEther("0.1") });

    expect(await nft.ownerOf(1)).to.equal(minter.address);
    expect(await ethers.provider.getBalance(nftAddress)).to.equal(
      ethers.parseEther("0.1")
    );
  });

  it("rejects the wrong ETH amount in native mode", async () => {
    const { nft, minter } = await deployFixture();

    await nft.setPublicPrice(ethers.parseEther("0.1"));
    await nft.setPublicMintOpen(true);

    await expect(
      nft.connect(minter).publicMint(1, { value: ethers.parseEther("0.05") })
    ).to.be.revertedWithCustomError(nft, "WrongPayment");
  });

  it("only lets the owner configure the payment asset", async () => {
    const { nft, tokenAddress, other } = await deployFixture();

    await expect(
      nft.connect(other).setPaymentToken(tokenAddress)
    ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");

    await expect(
      nft.setPaymentToken(other.address)
    ).to.be.revertedWithCustomError(nft, "InvalidPaymentToken");
  });

  it("lets the owner withdraw the ARIWA collected by mints", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, token, minter, owner } = fixture;

    await token.mint(minter.address, ONE);
    await openAriwaMint(fixture);
    await token.connect(minter).approve(nftAddress, ONE);
    await nft.connect(minter).publicMint(1);

    await nft.withdrawToken(await token.getAddress(), owner.address, ONE);

    expect(await token.balanceOf(nftAddress)).to.equal(0n);
    expect(await token.balanceOf(owner.address)).to.equal(ONE);
  });

  it("lets the owner update the per-wallet quantity later", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, token, minter } = fixture;

    await token.mint(minter.address, ONE * 4n);
    await openAriwaMint(fixture);
    await nft.setMaxPerWallet(2);
    await token.connect(minter).approve(nftAddress, ONE * 2n);

    await nft.connect(minter).publicMint(2);

    await expect(nft.connect(minter).publicMint(1)).to.be.revertedWithCustomError(
      nft,
      "ExceedsWalletCap"
    );
  });
});
