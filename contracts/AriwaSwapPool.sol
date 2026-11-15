// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AriwaSwapPool
 * @notice A fixed-rate ARIWA/ETH liquidity pool. The contract itself is the
 *         "pool wallet": it holds the ETH and ARIWA reserves and trades against
 *         users at a rate the owner sets. Testnet only.
 *
 *         Buying sends ETH and receives ARIWA. Selling sends ARIWA and
 *         receives ETH. Both directions use the same rate, so the pool has no
 *         spread — keep it topped up if you expect two-way flow.
 */
contract AriwaSwapPool is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @notice The ARIWA token traded by this pool.
    IERC20 public immutable token;

    /// @notice ARIWA paid per 1 ETH, expressed in wei (18 decimals).
    ///         e.g. 10_000e18 = 10,000 ARIWA per 1 ETH.
    uint256 public tokensPerEth;

    event TokensPurchased(address indexed buyer, uint256 ethIn, uint256 tokensOut);
    event TokensSold(address indexed seller, uint256 tokensIn, uint256 ethOut);
    event RateUpdated(uint256 oldRate, uint256 newRate);
    event LiquidityAdded(address indexed from, uint256 ethAmount, uint256 tokenAmount);
    event LiquidityRemoved(address indexed to, uint256 ethAmount, uint256 tokenAmount);

    constructor(address token_, uint256 tokensPerEth_) Ownable(msg.sender) {
        require(token_ != address(0), "Token required");
        require(tokensPerEth_ > 0, "Rate required");

        token = IERC20(token_);
        tokensPerEth = tokensPerEth_;
    }

    // ─── Trading ───────────────────────────────────────────────────────

    /**
     * @notice Buy ARIWA with ETH.
     * @param minTokensOut Slippage guard — revert if the quote falls below this.
     */
    function buyTokens(uint256 minTokensOut) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "No ETH sent");

        uint256 tokensOut = quoteBuy(msg.value);
        require(tokensOut >= minTokensOut, "Slippage exceeded");
        require(token.balanceOf(address(this)) >= tokensOut, "Insufficient token liquidity");

        token.safeTransfer(msg.sender, tokensOut);
        emit TokensPurchased(msg.sender, msg.value, tokensOut);
    }

    /**
     * @notice Sell ARIWA for ETH. The pool must be approved to spend the tokens.
     * @param tokenAmount Amount of ARIWA to sell (wei).
     * @param minEthOut Slippage guard — revert if the quote falls below this.
     */
    function sellTokens(uint256 tokenAmount, uint256 minEthOut) external nonReentrant whenNotPaused {
        require(tokenAmount > 0, "No tokens sent");

        uint256 ethOut = quoteSell(tokenAmount);
        require(ethOut >= minEthOut, "Slippage exceeded");
        require(address(this).balance >= ethOut, "Insufficient ETH liquidity");

        token.safeTransferFrom(msg.sender, address(this), tokenAmount);

        (bool sent, ) = msg.sender.call{value: ethOut}("");
        require(sent, "ETH transfer failed");

        emit TokensSold(msg.sender, tokenAmount, ethOut);
    }

    // ─── Quotes ────────────────────────────────────────────────────────

    function quoteBuy(uint256 ethAmount) public view returns (uint256) {
        return (ethAmount * tokensPerEth) / 1 ether;
    }

    function quoteSell(uint256 tokenAmount) public view returns (uint256) {
        return (tokenAmount * 1 ether) / tokensPerEth;
    }

    // ─── Liquidity ─────────────────────────────────────────────────────

    /**
     * @notice Anyone can top up the pool. Approve the tokens first if sending
     *         both assets in one call.
     */
    function addLiquidity(uint256 tokenAmount) external payable nonReentrant {
        require(msg.value > 0 || tokenAmount > 0, "Nothing to add");

        if (tokenAmount > 0) {
            token.safeTransferFrom(msg.sender, address(this), tokenAmount);
        }

        emit LiquidityAdded(msg.sender, msg.value, tokenAmount);
    }

    function withdrawEth(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Recipient required");
        require(amount > 0 && amount <= address(this).balance, "Invalid amount");

        (bool sent, ) = to.call{value: amount}("");
        require(sent, "ETH transfer failed");

        emit LiquidityRemoved(to, amount, 0);
    }

    function withdrawTokens(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Recipient required");
        require(amount > 0 && amount <= token.balanceOf(address(this)), "Invalid amount");

        token.safeTransfer(to, amount);

        emit LiquidityRemoved(to, 0, amount);
    }

    // ─── Admin ─────────────────────────────────────────────────────────

    function setRate(uint256 newRate) external onlyOwner {
        require(newRate > 0, "Rate required");
        emit RateUpdated(tokensPerEth, newRate);
        tokensPerEth = newRate;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Plain ETH transfers top up the pool reserve.
    receive() external payable {
        emit LiquidityAdded(msg.sender, msg.value, 0);
    }
}
