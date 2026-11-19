import { parseAbi } from "viem";

/**
 * Minimal ABI for the AriwaNFT collection (ERC721A + Ownable +
 * ReentrancyGuard). Kept hand-written so the frontend does not depend on the
 * generated typechain artifacts.
 *
 * Matches `contracts/AriwaNFT.sol`.
 */
export const AriwaNFTABI = parseAbi([
  // ---- Reads ---------------------------------------------------------------
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function owner() view returns (address)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function maxSupply() pure returns (uint256)",
  "function maxPerWallet() view returns (uint256)",
  "function paymentToken() view returns (address)",
  "function publicPrice() view returns (uint256)",
  "function publicMintOpen() view returns (bool)",
  "function trustedSigner() view returns (address)",
  "function usedIpHashes(bytes32 ipHash) view returns (bool)",
  "function totalMinted() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function minted(address wallet) view returns (uint256)",
  "function balanceOf(address wallet) view returns (uint256)",
  "function remainingForWallet(address wallet) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getMintStats(address minter) view returns (uint256 minterNumMinted, uint256 currentTotalSupply, uint256 maxSupply)",

  // ---- Public write --------------------------------------------------------
  // Payable only in native-ETH mode; ARIWA mode pulls `publicPrice` through
  // transferFrom, so approve the collection first. `ipHash` + `signature` come
  // from /api/launchpad/mint-permit: one permit per user, quantity is 1.
  "function publicMint(uint256 quantity, bytes32 ipHash, bytes signature) payable",

  // ---- Owner writes --------------------------------------------------------
  "function ownerMint(address to, uint256 quantity)",
  "function setPublicMintOpen(bool value)",
  "function setTrustedSigner(address signer)",
  "function setMaxPerWallet(uint256 newMax)",
  "function setPaymentToken(address token)",
  "function setPublicPrice(uint256 value)",
  "function setBaseURI(string baseURI_)",
  "function withdraw(address to)",
  "function withdrawToken(address token, address to, uint256 amount)",
  "function transferOwnership(address newOwner)",
  "function renounceOwnership()",

  // ---- Events --------------------------------------------------------------
  // Standard ERC-721 transfer, emitted by ERC721A on every mint. The launchpad
  // reads the mint receipt to learn which token id the minter received.
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event PublicMinted(address indexed wallet, uint256 quantity)",
  "event NetworkMinted(bytes32 indexed ipHash, address indexed wallet, uint256 quantity)",
  "event MaxPerWalletUpdated(uint256 maxPerWallet)",
  "event PaymentTokenUpdated(address indexed token)",
  "event PublicPriceUpdated(uint256 price)",
  "event TrustedSignerUpdated(address indexed signer)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",

  // ---- Errors --------------------------------------------------------------
  "error PublicClosed()",
  "error ZeroQuantity()",
  "error InvalidQuantity()",
  "error ExceedsWalletCap()",
  "error ExceedsSupply()",
  "error WrongPayment()",
  "error WithdrawFailed()",
  "error ZeroAddress()",
  "error InvalidMaxPerWallet()",
  "error InvalidPaymentToken()",
  "error InsufficientTokenBalance()",
  "error InvalidIpHash()",
  "error IpAlreadyMinted()",
  "error InvalidPermit()",
  "error SignerNotSet()",
  "error InvalidTrustedSigner()",
  "error OwnableUnauthorizedAccount(address account)",
  "error OwnableInvalidOwner(address owner)",
  "error URIQueryForNonexistentToken()",
]);
