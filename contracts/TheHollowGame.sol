// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TheHollowGame
 * @notice Pay-to-play contract for The Hollow game on GIWA Sepolia.
 * @dev Players pay in HollowToken (GIWA, an ERC20) to play. The player must
 *      approve this contract for at least `playPrice` before calling
 *      {payToPlay}; the fee is pulled via transferFrom. The owner sets the
 *      price (in token wei) and withdraws collected tokens.
 */
contract TheHollowGame is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Token used for payment (HollowToken / GIWA, 18 decimals).
    IERC20 public hollowToken;

    // Play price in token wei. Default 10 GIWA — owner can adjust via setPlayPrice.
    uint256 public playPrice = 10 * 10 ** 18;

    // Events
    event PlayPurchased(address indexed player, uint256 amount, uint256 timestamp);
    event PlayPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event PaymentTokenUpdated(address oldToken, address newToken);
    event FundsWithdrawn(address indexed owner, uint256 amount);

    /**
     * @param token_ HollowToken (GIWA) ERC20 address used for payments.
     */
    constructor(address token_) Ownable(msg.sender) {
        require(token_ != address(0), "Invalid token address");
        hollowToken = IERC20(token_);
    }

    /**
     * @notice Pay to play the game.
     * @dev Pulls exactly `playPrice` GIWA from the caller (requires prior approval)
     *      and emits PlayPurchased on success.
     */
    function payToPlay() external nonReentrant {
        hollowToken.safeTransferFrom(msg.sender, address(this), playPrice);
        emit PlayPurchased(msg.sender, playPrice, block.timestamp);
    }

    /**
     * @notice Set the play price (owner only)
     * @param _newPrice New price in token wei
     */
    function setPlayPrice(uint256 _newPrice) external onlyOwner {
        require(_newPrice > 0, "Price must be greater than 0");

        uint256 oldPrice = playPrice;
        playPrice = _newPrice;

        emit PlayPriceUpdated(oldPrice, _newPrice);
    }

    /**
     * @notice Update the payment token (owner only)
     * @param newToken New ERC20 token address
     */
    function setPaymentToken(address newToken) external onlyOwner {
        require(newToken != address(0), "Invalid token address");
        emit PaymentTokenUpdated(address(hollowToken), newToken);
        hollowToken = IERC20(newToken);
    }

    /**
     * @notice Get the current play price
     * @return Current price in token wei
     */
    function getPlayPrice() external view returns (uint256) {
        return playPrice;
    }

    /**
     * @notice Withdraw all collected tokens to owner (owner only)
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = hollowToken.balanceOf(address(this));
        require(balance > 0, "No funds to withdraw");

        hollowToken.safeTransfer(owner(), balance);

        emit FundsWithdrawn(owner(), balance);
    }

    /**
     * @notice Get contract token balance
     * @return Contract balance in token wei
     */
    function getBalance() external view returns (uint256) {
        return hollowToken.balanceOf(address(this));
    }
}
