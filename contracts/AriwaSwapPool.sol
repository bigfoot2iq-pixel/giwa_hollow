// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AriwaSwapPool
 * @notice A constant-product ARIWA/ETH automated market maker, the same model
 *         Uniswap v2 uses. The contract is the "pool wallet": it holds the ETH
 *         and ARIWA reserves and prices every trade against them with the
 *         x * y = k invariant. There is no owner-set rate — buying pushes the
 *         price up, selling pushes it down, and both sides always trade against
 *         the live reserves.
 *
 *         A swap fee (0.30% by default) stays in the reserves, so liquidity
 *         providers earn on every trade. The owner can adjust the fee (capped),
 *         pause trading, and withdraw reserves. Testnet only.
 */
contract AriwaSwapPool is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @notice Fee denominator; fees are expressed in basis points.
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Hard cap on the swap fee (5%) so the owner cannot rug traders.
    uint256 public constant MAX_FEE_BPS = 500;

    /// @notice Number of price points kept on chain for the live chart.
    uint256 public constant HISTORY_LIMIT = 256;

    /// @notice Both reserves must stay above this so the price never divides by zero.
    uint256 public constant MIN_LIQUIDITY = 1_000;

    /**
     * @notice One sample of the pool price.
     * @dev `tokensPerEth` is ARIWA per 1 ETH with 18 decimals — the same unit
     *      `tokensPerEth()` returns, inverted on the chart to show the ARIWA
     *      price in ETH.
     */
    struct PricePoint {
        uint64 timestamp;
        uint192 tokensPerEth;
    }

    /// @notice The ARIWA token traded by this pool.
    IERC20 public immutable token;

    /// @notice Swap fee in basis points (30 = 0.30%).
    uint256 public feeBps;

    /// @dev Ring buffer of recent price samples, newest at `_historyCount - 1`.
    PricePoint[256] private _history;

    /// @dev Total number of samples ever recorded (wraps around the buffer).
    uint256 private _historyCount;

    event TokensPurchased(
        address indexed buyer,
        uint256 ethIn,
        uint256 tokensOut,
        uint256 tokensPerEth
    );
    event TokensSold(
        address indexed seller,
        uint256 tokensIn,
        uint256 ethOut,
        uint256 tokensPerEth
    );
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event LiquidityAdded(address indexed from, uint256 ethAmount, uint256 tokenAmount);
    event LiquidityRemoved(address indexed to, uint256 ethAmount, uint256 tokenAmount);
    event PriceRecorded(uint256 timestamp, uint256 tokensPerEth);

    constructor(address token_, uint256 feeBps_) Ownable(msg.sender) {
        require(token_ != address(0), "Token required");
        require(feeBps_ <= MAX_FEE_BPS, "Fee too high");

        token = IERC20(token_);
        feeBps = feeBps_;
    }

    // ─── Trading ───────────────────────────────────────────────────────

    /**
     * @notice Buy ARIWA with ETH. The price is quoted from the live reserves,
     *         so each buy makes the next one slightly more expensive.
     * @param minTokensOut Slippage guard — revert if the quote falls below this.
     */
    function buyTokens(uint256 minTokensOut) external payable nonReentrant whenNotPaused {
        uint256 ethIn = msg.value;
        require(ethIn > 0, "No ETH sent");

        // msg.value is already in the contract balance, so subtract it to get
        // the reserve the trade is priced against.
        uint256 ethReserve = address(this).balance - ethIn;
        uint256 tokenReserve = token.balanceOf(address(this));
        require(ethReserve > 0 && tokenReserve > 0, "Pool not seeded");

        uint256 tokensOut = _getAmountOut(ethIn, ethReserve, tokenReserve);
        require(tokensOut > 0, "Amount too small");
        require(tokensOut >= minTokensOut, "Slippage exceeded");
        require(tokenReserve >= tokensOut, "Insufficient token liquidity");

        token.safeTransfer(msg.sender, tokensOut);

        emit TokensPurchased(msg.sender, ethIn, tokensOut, tokensPerEth());
        _recordPricePoint();
    }

    /**
     * @notice Sell ARIWA for ETH. The pool must be approved to spend the tokens.
     * @param tokenAmount Amount of ARIWA to sell (wei).
     * @param minEthOut Slippage guard — revert if the quote falls below this.
     */
    function sellTokens(uint256 tokenAmount, uint256 minEthOut)
        external
        nonReentrant
        whenNotPaused
    {
        require(tokenAmount > 0, "No tokens sent");

        uint256 ethReserve = address(this).balance;
        uint256 tokenReserve = token.balanceOf(address(this));
        require(ethReserve > 0 && tokenReserve > 0, "Pool not seeded");

        uint256 ethOut = _getAmountOut(tokenAmount, tokenReserve, ethReserve);
        require(ethOut > 0, "Amount too small");
        require(ethOut >= minEthOut, "Slippage exceeded");
        require(ethOut <= ethReserve, "Insufficient ETH liquidity");

        token.safeTransferFrom(msg.sender, address(this), tokenAmount);

        (bool sent, ) = msg.sender.call{value: ethOut}("");
        require(sent, "ETH transfer failed");

        emit TokensSold(msg.sender, tokenAmount, ethOut, tokensPerEth());
        _recordPricePoint();
    }

    // ─── Quotes & reserves ─────────────────────────────────────────────

    /// @notice Live reserves backing the market.
    function getReserves() public view returns (uint256 ethReserve, uint256 tokenReserve) {
        return (address(this).balance, token.balanceOf(address(this)));
    }

    /**
     * @notice Current mid price as ARIWA per 1 ETH (18 decimals).
     * @dev This is derived from the reserves, not stored — it moves with every
     *      trade. Kept for dashboards that used the old fixed-rate getter.
     */
    function tokensPerEth() public view returns (uint256) {
        (uint256 ethReserve, uint256 tokenReserve) = getReserves();
        if (ethReserve == 0) return 0;
        return (tokenReserve * 1 ether) / ethReserve;
    }

    /// @notice Current mid price as ETH per 1 ARIWA (wei, 18 decimals).
    function spotPrice() external view returns (uint256) {
        (uint256 ethReserve, uint256 tokenReserve) = getReserves();
        if (tokenReserve == 0) return 0;
        return (ethReserve * 1 ether) / tokenReserve;
    }

    /// @notice Everything the trade page needs in one call.
    function getPoolState()
        external
        view
        returns (
            uint256 ethReserve,
            uint256 tokenReserve,
            uint256 tokensPerEth_,
            uint256 feeBps_
        )
    {
        (ethReserve, tokenReserve) = getReserves();
        tokensPerEth_ = ethReserve == 0 ? 0 : (tokenReserve * 1 ether) / ethReserve;
        feeBps_ = feeBps;
    }

    /// @notice ARIWA received for `ethAmount` ETH, net of the swap fee.
    function quoteBuy(uint256 ethAmount) public view returns (uint256) {
        (uint256 ethReserve, uint256 tokenReserve) = getReserves();
        return _getAmountOut(ethAmount, ethReserve, tokenReserve);
    }

    /// @notice ETH received for `tokenAmount` ARIWA, net of the swap fee.
    function quoteSell(uint256 tokenAmount) public view returns (uint256) {
        (uint256 ethReserve, uint256 tokenReserve) = getReserves();
        return _getAmountOut(tokenAmount, tokenReserve, ethReserve);
    }

    /// @notice Constant-product quote with the current fee applied.
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) external view returns (uint256) {
        return _getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function _getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal view returns (uint256) {
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0) return 0;
        uint256 amountInWithFee = amountIn * (BPS_DENOMINATOR - feeBps);
        return
            (amountInWithFee * reserveOut) /
            (reserveIn * BPS_DENOMINATOR + amountInWithFee);
    }

    // ─── Price history ─────────────────────────────────────────────────

    /**
     * @notice Recorded price samples, oldest first.
     * @dev The buffer keeps at most `HISTORY_LIMIT` points. Samples are only
     *      written when the mid price actually changes, so every point marks a
     *      trade or a liquidity move the chart should show.
     */
    function getPriceHistory() external view returns (PricePoint[] memory points) {
        uint256 count = _historyCount;
        if (count == 0) return new PricePoint[](0);

        uint256 size = count < 256 ? count : 256;
        uint256 start = count <= 256 ? 0 : count % 256;

        points = new PricePoint[](size);
        for (uint256 i = 0; i < size; ++i) {
            points[i] = _history[(start + i) % 256];
        }
    }

    /// @notice Total samples ever recorded (may exceed `HISTORY_LIMIT`).
    function pricePointCount() external view returns (uint256) {
        return _historyCount;
    }

    function _recordPricePoint() internal {
        (uint256 ethReserve, uint256 tokenReserve) = getReserves();
        if (ethReserve == 0 || tokenReserve == 0) return;

        uint256 price = (tokenReserve * 1 ether) / ethReserve;
        if (price == 0 || price > type(uint192).max) return;

        uint256 count = _historyCount;
        if (count > 0) {
            // `count - 1` is safe: count is at least 1 here.
            PricePoint storage last = _history[(count - 1) % 256];
            if (last.tokensPerEth == price) return;
        }

        _history[count % 256] = PricePoint({
            timestamp: uint64(block.timestamp),
            tokensPerEth: uint192(price)
        });
        _historyCount = count + 1;

        emit PriceRecorded(block.timestamp, price);
    }

    // ─── Liquidity ─────────────────────────────────────────────────────

    /**
     * @notice Anyone can top up the pool. The first deposit sets the opening
     *         price from the ETH/ARIWA ratio; later deposits shift the price
     *         the same way a Uniswap liquidity add does.
     * @dev Approve the tokens first when sending both assets in one call.
     */
    function addLiquidity(uint256 tokenAmount) external payable nonReentrant {
        uint256 ethAmount = msg.value;
        require(ethAmount > 0 || tokenAmount > 0, "Nothing to add");

        (uint256 ethReserve, uint256 tokenReserve) = getReserves();
        if (ethReserve == 0 || tokenReserve == 0) {
            require(ethAmount > 0 && tokenAmount > 0, "Seed both assets");
        }

        if (tokenAmount > 0) {
            token.safeTransferFrom(msg.sender, address(this), tokenAmount);
        }

        (uint256 newEthReserve, uint256 newTokenReserve) = getReserves();
        require(
            newEthReserve >= MIN_LIQUIDITY && newTokenReserve >= MIN_LIQUIDITY,
            "Liquidity too small"
        );

        emit LiquidityAdded(msg.sender, ethAmount, tokenAmount);
        _recordPricePoint();
    }

    function withdrawEth(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Recipient required");
        require(amount > 0 && amount <= address(this).balance, "Invalid amount");

        (bool sent, ) = to.call{value: amount}("");
        require(sent, "ETH transfer failed");

        emit LiquidityRemoved(to, amount, 0);
        _recordPricePoint();
    }

    function withdrawTokens(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Recipient required");
        require(amount > 0 && amount <= token.balanceOf(address(this)), "Invalid amount");

        token.safeTransfer(to, amount);

        emit LiquidityRemoved(to, 0, amount);
        _recordPricePoint();
    }

    // ─── Admin ─────────────────────────────────────────────────────────

    /// @notice Set the swap fee in basis points. Capped at `MAX_FEE_BPS`.
    function setFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "Fee too high");
        emit FeeUpdated(feeBps, newFeeBps);
        feeBps = newFeeBps;
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
        // Keep the deposit cheap enough for a bare 2300-gas ETH send, but still
        // record the price move when the caller forwarded enough gas.
        if (gasleft() > 60_000) {
            _recordPricePoint();
        }
    }
}
