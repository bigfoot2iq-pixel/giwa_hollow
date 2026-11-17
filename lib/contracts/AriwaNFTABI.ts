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
  "function totalMinted() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function minted(address wallet) view returns (uint256)",
  "function balanceOf(address wallet) view returns (uint256)",
  "function remainingForWallet(address wallet) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getMintStats(address minter) view returns (uint256 minterNumMinted, uint256 currentTotalSupply, uint256 maxSupply)",

  // ---- Public write --------------------------------------------------------
  // Payable only in native-ETH mode; ARIWA mode pulls `publicPrice * quantity`
  // through transferFrom, so approve the collection first.
  "function publicMint(uint256 quantity) payable",

  // ---- Owner writes --------------------------------------------------------
  "function ownerMint(address to, uint256 quantity)",
  "function setPublicMintOpen(bool value)",
  "function setMaxPerWallet(uint256 newMax)",
  "function setPaymentToken(address token)",
  "function setPublicPrice(uint256 value)",
  "function setBaseURI(string baseURI_)",
  "function withdraw(address to)",
  "function withdrawToken(address token, address to, uint256 amount)",
  "function transferOwnership(address newOwner)",
  "function renounceOwnership()",

  // ---- Events --------------------------------------------------------------
  "event PublicMinted(address indexed wallet, uint256 quantity)",
  "event MaxPerWalletUpdated(uint256 maxPerWallet)",
  "event PaymentTokenUpdated(address indexed token)",
  "event PublicPriceUpdated(uint256 price)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",

  // ---- Errors --------------------------------------------------------------
  "error PublicClosed()",
  "error ZeroQuantity()",
  "error ExceedsWalletCap()",
  "error ExceedsSupply()",
  "error WrongPayment()",
  "error WithdrawFailed()",
  "error ZeroAddress()",
  "error InvalidMaxPerWallet()",
  "error InvalidPaymentToken()",
  "error InsufficientTokenBalance()",
  "error OwnableUnauthorizedAccount(address account)",
  "error OwnableInvalidOwner(address owner)",
  "error URIQueryForNonexistentToken()",
]);
