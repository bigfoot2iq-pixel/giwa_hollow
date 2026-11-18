import { expect } from "chai";
import pkg from "hardhat";

const { ethers } = pkg;

const ONE = ethers.parseEther("1");
const BASE_URI = "https://example.test/metadata/";

const MINT_PERMIT_TYPES = {
  MintPermit: [
    { name: "ipHash", type: "bytes32" },
    { name: "wallet", type: "address" },
  ],
};

type TypedDataSigner = {
  address: string;
  signTypedData: (
    domain: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: Record<string, unknown>
  ) => Promise<string>;
};

function ipHash(label: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

async function signPermit(
  signer: TypedDataSigner,
  nftAddress: string,
  hash: string,
  wallet: string
) {
  const { chainId } = await ethers.provider.getNetwork();

  return signer.signTypedData(
    {
      name: "ARIWA NFT",
      version: "1",
      chainId,
      verifyingContract: nftAddress,
    },
    MINT_PERMIT_TYPES,
    { ipHash: hash, wallet }
  );
}

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

  // A dedicated key the app would hold server-side. It never needs funds.
  const permitSigner = ethers.Wallet.createRandom();
  await nft.setTrustedSigner(permitSigner.address);

  return {
    owner,
    minter,
    other,
    token,
    tokenAddress,
    nft,
    nftAddress,
    permitSigner,
  };
}

type Fixture = Awaited<ReturnType<typeof deployFixture>>;

/** Build the hash + signature pair for one network + wallet. */
async function permit(
  fixture: Fixture,
  label: string,
  signer: TypedDataSigner = fixture.permitSigner,
  wallet: string = fixture.minter.address
) {
  const hash = ipHash(label);
  const signature = await signPermit(signer, fixture.nftAddress, hash, wallet);
  return { ipHash: hash, signature };
}

/** Switch the collection to ARIWA payments at 1 ARIWA per NFT. */
async function openAriwaMint(fixture: Fixture) {
  const { nft, tokenAddress } = fixture;
  await nft.setPaymentToken(tokenAddress);
  await nft.setPublicPrice(ONE);
  await nft.setPublicMintOpen(true);
}

describe("AriwaNFT", () => {
  it("starts with a per-wallet cap of 1, one mint per network, and native payment", async () => {
    const { nft, permitSigner } = await deployFixture();

    expect(await nft.maxPerWallet()).to.equal(1n);
    expect(await nft.publicMintOpen()).to.equal(false);
    expect(await nft.paymentToken()).to.equal(ethers.ZeroAddress);
    expect(await nft.maxSupply()).to.equal(2222n);
    expect(await nft.publicPrice()).to.equal(0n);
    expect(await nft.trustedSigner()).to.equal(permitSigner.address);
  });

  it("mints one NFT with ARIWA and pulls the price from the minter", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, token, minter } = fixture;

    await token.mint(minter.address, ONE * 2n);
    await openAriwaMint(fixture);
    await token.connect(minter).approve(nftAddress, ONE);

    const { ipHash: hash, signature } = await permit(fixture, "minter-ip");

    await expect(nft.connect(minter).publicMint(1n, hash, signature))
      .to.emit(nft, "PublicMinted")
      .withArgs(minter.address, 1n)
      .and.to.emit(nft, "NetworkMinted")
      .withArgs(hash, minter.address, 1n);

    expect(await nft.ownerOf(1)).to.equal(minter.address);
    expect(await nft.minted(minter.address)).to.equal(1n);
    expect(await nft.usedIpHashes(hash)).to.equal(true);
    expect(await token.balanceOf(nftAddress)).to.equal(ONE);
    expect(await token.balanceOf(minter.address)).to.equal(ONE);
  });

  it("rejects a mint without an ARIWA allowance", async () => {
    const fixture = await deployFixture();
    const { nft, token, minter } = fixture;

    await token.mint(minter.address, ONE);
    await openAriwaMint(fixture);

    const { ipHash: hash, signature } = await permit(fixture, "no-allowance");

    await expect(nft.connect(minter).publicMint(1n, hash, signature)).to.be
      .reverted;
  });

  it("rejects a mint when the wallet cannot cover the price", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, token, minter } = fixture;

    await token.mint(minter.address, ONE / 2n);
    await openAriwaMint(fixture);
    await token.connect(minter).approve(nftAddress, ONE);

    const { ipHash: hash, signature } = await permit(fixture, "poor-wallet");

    await expect(
      nft.connect(minter).publicMint(1n, hash, signature)
    ).to.be.revertedWithCustomError(nft, "InsufficientTokenBalance");
  });

  it("rejects ETH sent while the payment token is an ERC20", async () => {
    const fixture = await deployFixture();
    const { nft, token, minter } = fixture;

    await token.mint(minter.address, ONE);
    await openAriwaMint(fixture);

    const { ipHash: hash, signature } = await permit(fixture, "eth-in-erc20");

    await expect(
      nft.connect(minter).publicMint(1n, hash, signature, { value: ONE })
    ).to.be.revertedWithCustomError(nft, "WrongPayment");
  });

  it("still supports native ETH when the payment token is the zero address", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, minter } = fixture;

    await nft.setPublicPrice(ethers.parseEther("0.1"));
    await nft.setPublicMintOpen(true);

    const { ipHash: hash, signature } = await permit(fixture, "native-ip");

    await nft
      .connect(minter)
      .publicMint(1n, hash, signature, { value: ethers.parseEther("0.1") });

    expect(await nft.ownerOf(1)).to.equal(minter.address);
    expect(await ethers.provider.getBalance(nftAddress)).to.equal(
      ethers.parseEther("0.1")
    );
  });

  it("rejects the wrong ETH amount in native mode", async () => {
    const fixture = await deployFixture();
    const { nft, minter } = fixture;

    await nft.setPublicPrice(ethers.parseEther("0.1"));
    await nft.setPublicMintOpen(true);

    const { ipHash: hash, signature } = await permit(fixture, "wrong-value");

    await expect(
      nft
        .connect(minter)
        .publicMint(1n, hash, signature, { value: ethers.parseEther("0.05") })
    ).to.be.revertedWithCustomError(nft, "WrongPayment");
  });

  it("rejects a second mint from the same network with a different wallet", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, token, minter, other } = fixture;

    await token.mint(minter.address, ONE);
    await token.mint(other.address, ONE);
    await openAriwaMint(fixture);
    await token.connect(minter).approve(nftAddress, ONE);
    await token.connect(other).approve(nftAddress, ONE);

    // The same network hash, signed once for each wallet. The server refuses
    // to issue the second permit in production, and the contract refuses to
    // consume the hash twice even if the signature were obtained.
    const first = await permit(
      fixture,
      "shared-network",
      fixture.permitSigner,
      minter.address
    );

    await nft.connect(minter).publicMint(1n, first.ipHash, first.signature);

    const second = await permit(
      fixture,
      "shared-network",
      fixture.permitSigner,
      other.address
    );

    await expect(
      nft.connect(other).publicMint(1n, second.ipHash, second.signature)
    ).to.be.revertedWithCustomError(nft, "IpAlreadyMinted");
  });

  it("lets the same wallet mint again only from a different network", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, token, minter } = fixture;

    await token.mint(minter.address, ONE * 2n);
    await openAriwaMint(fixture);
    await nft.setMaxPerWallet(2);
    await token.connect(minter).approve(nftAddress, ONE * 2n);

    const first = await permit(fixture, "network-a");
    await nft.connect(minter).publicMint(1n, first.ipHash, first.signature);

    const second = await permit(fixture, "network-b");
    await nft.connect(minter).publicMint(1n, second.ipHash, second.signature);

    expect(await nft.minted(minter.address)).to.equal(2n);
    expect(await nft.usedIpHashes(first.ipHash)).to.equal(true);
    expect(await nft.usedIpHashes(second.ipHash)).to.equal(true);
  });

  it("rejects a permit signed by an unknown key", async () => {
    const fixture = await deployFixture();
    const { nft, token, minter } = fixture;

    await token.mint(minter.address, ONE);
    await openAriwaMint(fixture);

    const impostor = ethers.Wallet.createRandom();
    const { ipHash: hash, signature } = await permit(
      fixture,
      "forged-permit",
      impostor
    );

    await expect(
      nft.connect(minter).publicMint(1n, hash, signature)
    ).to.be.revertedWithCustomError(nft, "InvalidPermit");
  });

  it("rejects a copied permit submitted by another wallet", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, token, minter, other } = fixture;

    await token.mint(minter.address, ONE);
    await token.mint(other.address, ONE);
    await openAriwaMint(fixture);
    await token.connect(other).approve(nftAddress, ONE);

    // Signed for `minter`, so a front-runner cannot consume it.
    const { ipHash: hash, signature } = await permit(
      fixture,
      "front-run",
      fixture.permitSigner,
      minter.address
    );

    await expect(
      nft.connect(other).publicMint(1n, hash, signature)
    ).to.be.revertedWithCustomError(nft, "InvalidPermit");
  });

  it("rejects a zero network hash", async () => {
    const fixture = await deployFixture();
    const { nft, token, minter } = fixture;

    await token.mint(minter.address, ONE);
    await openAriwaMint(fixture);

    const signature = await signPermit(
      fixture.permitSigner,
      fixture.nftAddress,
      ethers.ZeroHash,
      minter.address
    );

    await expect(
      nft.connect(minter).publicMint(1n, ethers.ZeroHash, signature)
    ).to.be.revertedWithCustomError(nft, "InvalidIpHash");
  });

  it("rejects any quantity other than one", async () => {
    const fixture = await deployFixture();
    const { nft, token, minter } = fixture;

    await token.mint(minter.address, ONE * 2n);
    await openAriwaMint(fixture);

    const { ipHash: hash, signature } = await permit(fixture, "batch-ip");

    await expect(
      nft.connect(minter).publicMint(2n, hash, signature)
    ).to.be.revertedWithCustomError(nft, "InvalidQuantity");

    await expect(
      nft.connect(minter).publicMint(0n, hash, signature)
    ).to.be.revertedWithCustomError(nft, "InvalidQuantity");
  });

  it("rejects minting while no permit signer is configured", async () => {
    const [owner, minter] = await ethers.getSigners();

    const NFT = await ethers.getContractFactory("AriwaNFT");
    const nft = await NFT.deploy(owner.address, BASE_URI);
    await nft.waitForDeployment();
    const nftAddress = await nft.getAddress();
    await nft.setPublicMintOpen(true);

    const signer = ethers.Wallet.createRandom();
    const hash = ipHash("no-signer");
    const signature = await signPermit(signer, nftAddress, hash, minter.address);

    await expect(
      nft.connect(minter).publicMint(1n, hash, signature)
    ).to.be.revertedWithCustomError(nft, "SignerNotSet");
  });

  it("still enforces the per-wallet cap across different networks", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, token, minter } = fixture;

    await token.mint(minter.address, ONE * 2n);
    await openAriwaMint(fixture);
    await token.connect(minter).approve(nftAddress, ONE * 2n);

    const first = await permit(fixture, "cap-a");
    await nft.connect(minter).publicMint(1n, first.ipHash, first.signature);

    const second = await permit(fixture, "cap-b");

    await expect(
      nft.connect(minter).publicMint(1n, second.ipHash, second.signature)
    ).to.be.revertedWithCustomError(nft, "ExceedsWalletCap");
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

  it("only lets the owner rotate the permit signer", async () => {
    const { nft, other } = await deployFixture();

    await expect(
      nft.connect(other).setTrustedSigner(other.address)
    ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");

    await expect(
      nft.setTrustedSigner(ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(nft, "InvalidTrustedSigner");
  });

  it("lets the owner withdraw the ARIWA collected by mints", async () => {
    const fixture = await deployFixture();
    const { nft, nftAddress, token, minter, owner } = fixture;

    await token.mint(minter.address, ONE);
    await openAriwaMint(fixture);
    await token.connect(minter).approve(nftAddress, ONE);

    const { ipHash: hash, signature } = await permit(fixture, "withdraw-ip");
    await nft.connect(minter).publicMint(1n, hash, signature);

    await nft.withdrawToken(await token.getAddress(), owner.address, ONE);

    expect(await token.balanceOf(nftAddress)).to.equal(0n);
    expect(await token.balanceOf(owner.address)).to.equal(ONE);
  });
});
