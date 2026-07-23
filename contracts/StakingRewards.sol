// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title StakingRewards
 * @dev Distributes Hollow token rewards to avKAT and vKAT stakers.
 *
 * Each token (avKAT / vKAT) has:
 *   - 3 owner-configurable tiers (threshold + hollow amount)
 *   - Its own lastClaim timestamp per wallet
 *
 * A single global claimWindowHours applies to both.
 *
 * Claims use a backend-signed voucher pattern:
 *   - Backend reads avKAT balance (on-chain) + vKAT balance (indexer)
 *   - Determines tier and signs (user, amount, expiry, nonce, chainId)
 *   - User submits the voucher and pays gas themselves
 */
contract StakingRewards is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // ─── Structs ───────────────────────────────────────────────────────────────

    struct Tier {
        uint256 threshold;    // minimum staked balance to qualify (in wei)
        uint256 hollowAmount; // hollow tokens rewarded at this tier (in wei)
    }

    // ─── State ─────────────────────────────────────────────────────────────────

    IERC20 public immutable hollowToken;

    address public trustedSigner;
    uint256 public claimWindowHours; // global, applies to both tokens

    // 3 tiers each, index 0 = highest tier (checked first)
    Tier[3] public avKATTiers;
    Tier[3] public vKATTiers;

    // Separate claim tracking per token per wallet
    mapping(address => uint256) public lastClaimAVKAT;
    mapping(address => uint256) public lastClaimVKAT;

    // Global nonce registry — a nonce can never be reused for either token
    mapping(bytes32 => bool) public usedNonces;

    // ─── Events ────────────────────────────────────────────────────────────────

    event AVKATRewardClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event VKATRewardClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event AVKATTiersUpdated(Tier[3] tiers);
    event VKATTiersUpdated(Tier[3] tiers);
    event TrustedSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event ClaimWindowUpdated(uint256 oldHours, uint256 newHours);
    event TreasuryWithdrawn(address indexed to, uint256 amount);

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address hollowToken_,
        address trustedSigner_,
        uint256 claimWindowHours_
    ) Ownable(msg.sender) {
        require(hollowToken_ != address(0), "Invalid hollow token");
        require(trustedSigner_ != address(0), "Invalid signer");
        require(claimWindowHours_ > 0, "Window must be > 0");

        hollowToken = IERC20(hollowToken_);
        trustedSigner = trustedSigner_;
        claimWindowHours = claimWindowHours_;
    }

    // ─── Owner: Tier Config ────────────────────────────────────────────────────

    /**
     * @notice Set avKAT reward tiers. Thresholds must be strictly descending.
     * @param thresholds [tier0, tier1, tier2] minimum balances in wei, highest first
     * @param amounts    [tier0, tier1, tier2] hollow amounts in wei
     */
    function setAVKATTiers(
        uint256[3] calldata thresholds,
        uint256[3] calldata amounts
    ) external onlyOwner {
        require(
            thresholds[0] > thresholds[1] && thresholds[1] > thresholds[2],
            "Thresholds must be strictly descending"
        );
        for (uint8 i = 0; i < 3; i++) {
            require(amounts[i] > 0, "Amount must be > 0");
            avKATTiers[i] = Tier(thresholds[i], amounts[i]);
        }
        emit AVKATTiersUpdated(avKATTiers);
    }

    /**
     * @notice Set vKAT reward tiers. Thresholds must be strictly descending.
     * @param thresholds [tier0, tier1, tier2] minimum balances in wei, highest first
     * @param amounts    [tier0, tier1, tier2] hollow amounts in wei
     */
    function setVKATTiers(
        uint256[3] calldata thresholds,
        uint256[3] calldata amounts
    ) external onlyOwner {
        require(
            thresholds[0] > thresholds[1] && thresholds[1] > thresholds[2],
            "Thresholds must be strictly descending"
        );
        for (uint8 i = 0; i < 3; i++) {
            require(amounts[i] > 0, "Amount must be > 0");
            vKATTiers[i] = Tier(thresholds[i], amounts[i]);
        }
        emit VKATTiersUpdated(vKATTiers);
    }

    // ─── Owner: Global Config ──────────────────────────────────────────────────

    function setTrustedSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Invalid signer");
        emit TrustedSignerUpdated(trustedSigner, newSigner);
        trustedSigner = newSigner;
    }

    function setClaimWindow(uint256 hours_) external onlyOwner {
        require(hours_ > 0, "Window must be > 0");
        emit ClaimWindowUpdated(claimWindowHours, hours_);
        claimWindowHours = hours_;
    }

    // ─── Owner: Treasury ──────────────────────────────────────────────────────

    function withdrawTreasury(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        require(hollowToken.balanceOf(address(this)) >= amount, "Insufficient treasury");
        hollowToken.transfer(owner(), amount);
        emit TreasuryWithdrawn(owner(), amount);
    }

    // ─── Claims ────────────────────────────────────────────────────────────────

    /**
     * @notice Claim avKAT staking rewards using a backend-signed voucher.
     * @param amount    Hollow amount to receive (in wei), as signed by backend
     * @param expiry    Unix timestamp after which the voucher is invalid
     * @param nonce     Unique value to prevent voucher reuse
     * @param signature Backend signature over (msg.sender, amount, expiry, nonce, chainId)
     */
    function claimAVKAT(
        uint256 amount,
        uint256 expiry,
        bytes32 nonce,
        bytes calldata signature
    ) external nonReentrant {
        require(block.timestamp < expiry, "Voucher expired");
        require(!usedNonces[nonce], "Nonce already used");
        require(
            block.timestamp >= lastClaimAVKAT[msg.sender] + (claimWindowHours * 1 hours),
            "avKAT claim window not elapsed"
        );

        _verifySignature(msg.sender, amount, expiry, nonce, signature);
        _executeClaim(amount, nonce);

        lastClaimAVKAT[msg.sender] = block.timestamp;
        emit AVKATRewardClaimed(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Claim vKAT staking rewards using a backend-signed voucher.
     * @param amount    Hollow amount to receive (in wei), as signed by backend
     * @param expiry    Unix timestamp after which the voucher is invalid
     * @param nonce     Unique value to prevent voucher reuse
     * @param signature Backend signature over (msg.sender, amount, expiry, nonce, chainId)
     */
    function claimVKAT(
        uint256 amount,
        uint256 expiry,
        bytes32 nonce,
        bytes calldata signature
    ) external nonReentrant {
        require(block.timestamp < expiry, "Voucher expired");
        require(!usedNonces[nonce], "Nonce already used");
        require(
            block.timestamp >= lastClaimVKAT[msg.sender] + (claimWindowHours * 1 hours),
            "vKAT claim window not elapsed"
        );

        _verifySignature(msg.sender, amount, expiry, nonce, signature);
        _executeClaim(amount, nonce);

        lastClaimVKAT[msg.sender] = block.timestamp;
        emit VKATRewardClaimed(msg.sender, amount, block.timestamp);
    }

    // ─── Internal ──────────────────────────────────────────────────────────────

    function _verifySignature(
        address user,
        uint256 amount,
        uint256 expiry,
        bytes32 nonce,
        bytes calldata signature
    ) internal view {
        bytes32 hash = keccak256(abi.encodePacked(
            user,
            amount,
            expiry,
            nonce,
            block.chainid
        ));
        address recovered = ECDSA.recover(
            MessageHashUtils.toEthSignedMessageHash(hash),
            signature
        );
        require(recovered == trustedSigner, "Invalid signature");
    }

    function _executeClaim(uint256 amount, bytes32 nonce) internal {
        require(amount > 0, "Amount must be > 0");
        require(hollowToken.balanceOf(address(this)) >= amount, "Insufficient treasury");
        usedNonces[nonce] = true;
        hollowToken.transfer(msg.sender, amount);
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    /**
     * @notice Check if a wallet can claim avKAT rewards and how long until they can.
     */
    function canClaimAVKAT(address user) external view returns (bool eligible, uint256 secondsRemaining) {
        uint256 nextClaimAt = lastClaimAVKAT[user] + (claimWindowHours * 1 hours);
        if (block.timestamp >= nextClaimAt) return (true, 0);
        return (false, nextClaimAt - block.timestamp);
    }

    /**
     * @notice Check if a wallet can claim vKAT rewards and how long until they can.
     */
    function canClaimVKAT(address user) external view returns (bool eligible, uint256 secondsRemaining) {
        uint256 nextClaimAt = lastClaimVKAT[user] + (claimWindowHours * 1 hours);
        if (block.timestamp >= nextClaimAt) return (true, 0);
        return (false, nextClaimAt - block.timestamp);
    }

    /**
     * @notice Current Hollow token balance held by this contract.
     */
    function treasuryBalance() external view returns (uint256) {
        return hollowToken.balanceOf(address(this));
    }
}
