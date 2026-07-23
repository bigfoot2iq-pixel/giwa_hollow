// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract HollowToken is ERC20, ERC20Burnable, Ownable, ReentrancyGuard, Pausable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;
    uint8 public constant CATEGORY_COUNT = 4;

    uint256[4] public categoryAmount;
    uint256[4] public categoryFee;
    string[4] public categoryName;

    uint256 public claimCooldown;

    mapping(address => uint256) public lastClaimTimestamp;

    event TokensClaimed(address indexed claimer, uint8 indexed categoryId, uint256 amount, uint256 feePaid);
    event CategoryUpdated(uint8 indexed categoryId, string name, uint256 amount, uint256 fee);
    event ClaimCooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 claimCooldown_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        claimCooldown = claimCooldown_;
    }

    // ─── Claiming ──────────────────────────────────────────────────────

    function claimTokens(uint8 categoryId) external payable nonReentrant whenNotPaused {
        require(categoryId < CATEGORY_COUNT, "Invalid category");
        require(categoryAmount[categoryId] > 0, "Category disabled");
        require(msg.value >= categoryFee[categoryId], "Insufficient fee");
        require(
            block.timestamp >= lastClaimTimestamp[msg.sender] + claimCooldown,
            "Cooldown not elapsed"
        );
        require(
            totalSupply() + categoryAmount[categoryId] <= MAX_SUPPLY,
            "Max supply reached"
        );

        lastClaimTimestamp[msg.sender] = block.timestamp;
        _mint(msg.sender, categoryAmount[categoryId]);

        uint256 feePaid = categoryFee[categoryId];
        emit TokensClaimed(msg.sender, categoryId, categoryAmount[categoryId], feePaid);

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

    function getCategoryAmount(uint8 categoryId) external view returns (uint256) {
        require(categoryId < CATEGORY_COUNT, "Invalid category");
        return categoryAmount[categoryId];
    }

    function getCategoryFee(uint8 categoryId) external view returns (uint256) {
        require(categoryId < CATEGORY_COUNT, "Invalid category");
        return categoryFee[categoryId];
    }

    function getCategoryName(uint8 categoryId) external view returns (string memory) {
        require(categoryId < CATEGORY_COUNT, "Invalid category");
        return categoryName[categoryId];
    }

    function getClaimAmount(uint8 categoryId) external view returns (uint256) {
        require(categoryId < CATEGORY_COUNT, "Invalid category");
        return categoryAmount[categoryId];
    }

    // ─── Admin: categories ─────────────────────────────────────────────

    function setCategory(
        uint8 categoryId,
        string calldata name,
        uint256 amount,
        uint256 fee
    ) external onlyOwner {
        require(categoryId < CATEGORY_COUNT, "Invalid category");
        categoryName[categoryId] = name;
        categoryAmount[categoryId] = amount;
        categoryFee[categoryId] = fee;
        emit CategoryUpdated(categoryId, name, amount, fee);
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
