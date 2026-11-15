// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721A} from "erc721a/contracts/ERC721A.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AriwaNFT
 * @notice 2,222 ARIWA Genesis on GIWA.
 *
 *   - Public — anyone mints for {publicPrice} each while {publicMintOpen},
 *     up to {maxPerWallet} tokens per wallet.
 *   - Owner — {ownerMint} mints straight to any address for free (team,
 *     treasury, and any manual distributions), exempt from the per-wallet cap.
 *
 * The public phase is held on-chain: the owner opens it, sets the price, and
 * closes it again. A single owner-controlled cap, {maxPerWallet} (default 1),
 * applies to the public phase. Owner mints are exempt from that cap but still
 * bounded by total supply.
 *
 * @dev The launchpad reads supply and per-wallet progress through {maxSupply}
 *      and {getMintStats}, so both are exposed as views on top of the ERC721A
 *      surface.
 */
contract AriwaNFT is ERC721A, Ownable, ReentrancyGuard {
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
    /// @notice Price per token for the public phase, in wei of the native
    /// currency (ETH, 18 decimals on GIWA).
    uint256 public publicPrice;

    string private _baseTokenURI;

    // ---- Per-wallet tracking ------------------------------------------------
    /// @notice Public mints per wallet (enforces the per-wallet cap).
    mapping(address => uint256) public minted;

    event PublicMinted(address indexed wallet, uint256 quantity);
    event MaxPerWalletUpdated(uint256 maxPerWallet);

    error PublicClosed();
    error ZeroQuantity();
    error ExceedsWalletCap();
    error ExceedsSupply();
    error WrongPayment();
    error WithdrawFailed();
    error ZeroAddress();
    error InvalidMaxPerWallet();

    /// @param initialOwner Address that receives the owner role. A zero address
    ///        is rejected by {Ownable} during construction.
    /// @param baseURI_ Base metadata URI. Token URIs resolve to
    ///        `{baseURI_}{tokenId}.json`.
    constructor(address initialOwner, string memory baseURI_)
        ERC721A("ARIWA Genesis", "ARIGEN")
        Ownable(initialOwner)
    {
        _baseTokenURI = baseURI_;
    }

    // ---- Minting ------------------------------------------------------------

    /// @notice Paid mint open to everyone, bounded by the per-wallet cap.
    function publicMint(uint256 quantity) external payable nonReentrant {
        if (!publicMintOpen) revert PublicClosed();
        if (quantity == 0) revert ZeroQuantity();
        if (minted[msg.sender] + quantity > maxPerWallet) revert ExceedsWalletCap();
        if (_totalMinted() + quantity > MAX_SUPPLY) revert ExceedsSupply();
        if (msg.value != publicPrice * quantity) revert WrongPayment();

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

    function setPublicPrice(uint256 value) external onlyOwner {
        publicPrice = value;
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
    }

    /// @notice Sweep the native balance to the given address.
    function withdraw(address payable to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
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
