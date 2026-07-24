// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract HollowToken is ERC20, ERC20Burnable, Ownable, ReentrancyGuard, Pausable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    // Single, admin-controlled claim config. No tiers.
    uint256 public claimAmount; // tokens minted per claim (wei)
    uint256 public claimFee;    // ETH required per claim (wei)
    uint256 public claimCooldown; // seconds between claims per address

    mapping(address => uint256) public lastClaimTimestamp;

    event TokensClaimed(address indexed claimer, uint256 amount, uint256 feePaid);
    event ClaimAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event ClaimFeeUpdated(uint256 oldFee, uint256 newFee);
    event ClaimCooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 claimAmount_,
        uint256 claimFee_,
        uint256 claimCooldown_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        claimAmount = claimAmount_;
        claimFee = claimFee_;
        claimCooldown = claimCooldown_;
    }

    // ─── Claiming ──────────────────────────────────────────────────────

    function claimTokens() external payable nonReentrant whenNotPaused {
        require(claimAmount > 0, "Claim disabled");
        require(msg.value >= claimFee, "Insufficient fee");
        require(
            block.timestamp >= lastClaimTimestamp[msg.sender] + claimCooldown,
            "Cooldown not elapsed"
        );
        require(totalSupply() + claimAmount <= MAX_SUPPLY, "Max supply reached");

        lastClaimTimestamp[msg.sender] = block.timestamp;
        _mint(msg.sender, claimAmount);

        uint256 feePaid = claimFee;
        emit TokensClaimed(msg.sender, claimAmount, feePaid);

        if (msg.value > feePaid) {
            (bool refunded, ) = msg.sender.call{value: msg.value - feePaid}("");
            require(refunded, "Refund failed");
        }
    }

    function canClaim(address account) external view returns (bool) {
        return block.timestamp >= lastClaimTimestamp[account] + claimCooldown;
    }

    function getLastClaimTimestamp(address account) external view returns (uint256) {
        return lastClaimTimestamp[account];
    }

    // ─── Admin: claim config ───────────────────────────────────────────

    function setClaimAmount(uint256 newAmount) external onlyOwner {
        emit ClaimAmountUpdated(claimAmount, newAmount);
        claimAmount = newAmount;
    }

    function setClaimFee(uint256 newFee) external onlyOwner {
        emit ClaimFeeUpdated(claimFee, newFee);
        claimFee = newFee;
    }

    function setClaimCooldown(uint256 newCooldown) external onlyOwner {
        emit ClaimCooldownUpdated(claimCooldown, newCooldown);
        claimCooldown = newCooldown;
    }

    // ─── Admin: supply & fees ──────────────────────────────────────────

    function ownerWithdraw(uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply reached");
        _mint(owner(), amount);
    }

    function withdrawFees(address to) external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        (bool success, ) = to.call{value: balance}("");
        require(success, "Withdraw failed");
        emit FeesWithdrawn(to, balance);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply reached");
        _mint(to, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    receive() external payable {}
}
