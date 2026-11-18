// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721A} from "erc721a/contracts/ERC721A.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AriwaNFT
 * @notice 2,222 ARIWA NFT on GIWA.
 *
 *   - Public — anyone mints for {publicPrice} of {paymentToken} each while
 *     {publicMintOpen}, up to {maxPerWallet} tokens per wallet.
 *   - Owner — {ownerMint} mints straight to any address for free (team,
 *     treasury, and any manual distributions), exempt from the per-wallet cap.
 *
 * The public phase is held on-chain: the owner opens it, sets the price, picks
 * the payment asset, and closes it again. A single owner-controlled cap,
 * {maxPerWallet} (default 1), applies to the public phase. Owner mints are
 * exempt from that cap but still bounded by total supply.
 *
 * {paymentToken} is an owner-controlled ERC20 address. Setting it to the zero
 * address makes the mint payable in the chain's native currency (ETH on GIWA);
 * setting it to an ERC20 (ARIWA) makes the mint pull {publicPrice} tokens per
 * NFT through `transferFrom`, so the minter must approve this contract first.
 * `publicPrice` is always expressed in the payment asset's smallest unit
 * (wei for ETH, 18-decimal base units for ARIWA).
 *
 * @dev The launchpad reads supply and per-wallet progress through {maxSupply}
 *      and {getMintStats}, so both are exposed as views on top of the ERC721A
 *      surface.
 */
contract AriwaNFT is ERC721A, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---- Immutable collection limits ----------------------------------------
    /// @notice Hard cap on the number of tokens that can ever exist.
    uint256 public constant MAX_SUPPLY = 2222;

    /// @notice Maximum tokens a single wallet may mint in the public phase.
    /// @dev Owner-controlled. Lowering it does not affect tokens already minted,
    ///      but it blocks further public mints once a wallet reaches the new cap.
    uint256 public maxPerWallet = 1;

    // ---- Phase switch (owner controlled) ------------------------------------
    /// @notice Whether the public mint is open.
    bool public publicMintOpen;

    // ---- Economics / config -------------------------------------------------
    /// @notice ERC20 used to pay for public mints. `address(0)` means the
    /// chain's native currency (ETH on GIWA).
    address public paymentToken;

    /// @notice Price per token for the public phase, in the smallest unit of
    /// {paymentToken} (wei when the payment asset is native ETH).
    uint256 public publicPrice;

    string private _baseTokenURI;

    // ---- Per-wallet tracking ------------------------------------------------
    /// @notice Public mints per wallet (enforces the per-wallet cap).
    mapping(address => uint256) public minted;

    event PublicMinted(address indexed wallet, uint256 quantity);
    event MaxPerWalletUpdated(uint256 maxPerWallet);
    event PaymentTokenUpdated(address indexed token);
    event PublicPriceUpdated(uint256 price);

    error PublicClosed();
    error ZeroQuantity();
    error ExceedsWalletCap();
    error ExceedsSupply();
    error WrongPayment();
    error WithdrawFailed();
    error ZeroAddress();
    error InvalidMaxPerWallet();
    error InvalidPaymentToken();
    error InsufficientTokenBalance();

    /// @param initialOwner Address that receives the owner role. A zero address
    ///        is rejected by {Ownable} during construction.
    /// @param baseURI_ Base metadata URI. Token URIs resolve to
    ///        `{baseURI_}{tokenId}.json`.
    constructor(address initialOwner, string memory baseURI_)
        ERC721A("ARIWA NFT", "ARIWA")
        Ownable(initialOwner)
    {
        _baseTokenURI = baseURI_;
    }

    // ---- Minting ------------------------------------------------------------

    /// @notice Paid mint open to everyone, bounded by the per-wallet cap.
    /// @dev When {paymentToken} is an ERC20, the caller must have approved this
    ///      contract for at least `publicPrice * quantity` first. Any ETH sent
    ///      in ERC20 mode is rejected.
    function publicMint(uint256 quantity) external payable nonReentrant {
        if (!publicMintOpen) revert PublicClosed();
        if (quantity == 0) revert ZeroQuantity();
        if (minted[msg.sender] + quantity > maxPerWallet) revert ExceedsWalletCap();
        if (_totalMinted() + quantity > MAX_SUPPLY) revert ExceedsSupply();

        uint256 cost = publicPrice * quantity;
        address token = paymentToken;

        if (token == address(0)) {
            if (msg.value != cost) revert WrongPayment();
        } else {
            if (msg.value != 0) revert WrongPayment();
            if (cost > 0) {
                IERC20 asset = IERC20(token);
                if (asset.balanceOf(msg.sender) < cost) revert InsufficientTokenBalance();
                asset.safeTransferFrom(msg.sender, address(this), cost);
            }
        }

        minted[msg.sender] += quantity;
        _mint(msg.sender, quantity);
        emit PublicMinted(msg.sender, quantity);
    }

    // ---- Owner --------------------------------------------------------------

    /// @notice Mint straight to an address for free (team/treasury reserves),
    /// still bounded by total supply but exempt from the per-wallet cap.
    function ownerMint(address to, uint256 quantity) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (quantity == 0) revert ZeroQuantity();
        if (_totalMinted() + quantity > MAX_SUPPLY) revert ExceedsSupply();
        _mint(to, quantity);
    }

    function setPublicMintOpen(bool value) external onlyOwner {
        publicMintOpen = value;
    }

    /// @notice Update the public-phase per-wallet cap.
    function setMaxPerWallet(uint256 newMax) external onlyOwner {
        if (newMax == 0) revert InvalidMaxPerWallet();
        maxPerWallet = newMax;
        emit MaxPerWalletUpdated(newMax);
    }

    /// @notice Update the price per token. The unit follows {paymentToken}.
    function setPublicPrice(uint256 value) external onlyOwner {
        publicPrice = value;
        emit PublicPriceUpdated(value);
    }

    /// @notice Choose the asset public mints are paid in.
    /// @param token ERC20 address, or `address(0)` for native ETH.
    function setPaymentToken(address token) external onlyOwner {
        if (token != address(0) && token.code.length == 0) revert InvalidPaymentToken();
        paymentToken = token;
        emit PaymentTokenUpdated(token);
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
    }

    /// @notice Sweep the native balance (ETH) to the given address.
    function withdraw(address payable to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
    }

    /// @notice Sweep an ERC20 balance — the ARIWA collected by public mints —
    /// to the given address.
    function withdrawToken(address token, address to, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroQuantity();
        IERC20(token).safeTransfer(to, amount);
    }

    // ---- Views / overrides --------------------------------------------------

    /// @notice Total tokens minted so far (for supply progress UIs).
    function totalMinted() external view returns (uint256) {
        return _totalMinted();
    }

    /// @notice Hard supply cap. Mirrors {MAX_SUPPLY} for clients that read the
    /// collection generically.
    function maxSupply() external pure returns (uint256) {
        return MAX_SUPPLY;
    }

    /// @notice Public mints a wallet can still make under the per-wallet cap.
    function remainingForWallet(address wallet) external view returns (uint256) {
        uint256 used = minted[wallet];
        return used >= maxPerWallet ? 0 : maxPerWallet - used;
    }

    /// @notice Mint counters for a wallet, plus the collection supply.
    /// @param minter Wallet to report on.
    /// @return minterNumMinted Tokens the wallet has minted.
    /// @return currentTotalSupply Tokens minted so far, collection wide.
    /// @return maxSupply The hard supply cap.
    function getMintStats(address minter)
        external
        view
        returns (uint256 minterNumMinted, uint256 currentTotalSupply, uint256 maxSupply)
    {
        minterNumMinted = minted[minter];
        currentTotalSupply = _totalMinted();
        maxSupply = MAX_SUPPLY;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        string memory base = _baseURI();
        return
            bytes(base).length != 0
                ? string(abi.encodePacked(base, _toString(tokenId), ".json"))
                : "";
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }
}
