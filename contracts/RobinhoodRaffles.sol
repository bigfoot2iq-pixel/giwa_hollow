// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title RobinhoodRaffles
 * @dev Minimal on-chain raffle contract with off-chain entry tracking.
 */
contract RobinhoodRaffles is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    enum PrizeType { ERC20, ERC721, ERC6220 }
    enum RaffleState { CREATED, ACTIVE, COMPLETED, CANCELLED }

    struct Raffle {
        PrizeType prizeType;
        address prizeToken;
        RaffleState state;
        uint256 prizeCount;
        bool isNFT;
        bool hasWinners;
        address creator;  // address(0) = owner/platform raffle; otherwise the user who created it
        uint256 endTime;  // 0 = owner-managed (no schedule); else unix time after which it may be ended
    }

    IERC20 public raffleToken;
    address public watchdog;
    uint256 public raffleCounter;
    uint256 public userRaffleFee;

    mapping(uint256 => Raffle) public raffles;
    mapping(uint256 => uint256[]) private rafflePrizeAmounts;
    mapping(uint256 => uint256[]) private rafflePrizeTokenIds;
    mapping(uint256 => address[]) private raffleWinners;

    event RaffleCreated(uint256 indexed raffleId, address indexed prizeToken, uint256 prizeCount, bool isNFT);
    event UserRaffleCreated(uint256 indexed raffleId, address indexed creator, uint256 endTime);
    event CreatorRefunded(uint256 indexed raffleId, address indexed creator, uint256 amount);
    event RaffleStateChanged(uint256 indexed raffleId, RaffleState oldState, RaffleState newState);
    event RaffleEnded(uint256 indexed raffleId, address[] winners, uint256 totalParticipants, uint256 totalTickets);
    event EntrySubmitted(uint256 indexed raffleId, address indexed participant, uint256 tokensSpent);
    event PrizeDistributed(uint256 indexed raffleId, address indexed winner, uint256 prizeValue);
    event EmergencyWithdraw(uint256 indexed raffleId, address indexed recipient, address prizeToken);
    event WatchdogUpdated(address oldWatchdog, address newWatchdog);
    event RaffleTokenUpdated(address oldToken, address newToken);
    event UserRaffleFeeUpdated(uint256 oldFee, uint256 newFee);

    modifier onlyOwnerOrWatchdog() {
        require(msg.sender == owner() || msg.sender == watchdog, "Not authorized");
        _;
    }

    modifier raffleExists(uint256 raffleId_) {
        require(raffles[raffleId_].prizeToken != address(0), "Raffle not found");
        _;
    }

    modifier raffleInState(uint256 raffleId_, RaffleState expectedState_) {
        require(raffles[raffleId_].state == expectedState_, "Invalid raffle state");
        _;
    }

    constructor(address raffleToken_, address watchdog_) Ownable(msg.sender) {
        require(raffleToken_ != address(0), "Invalid token address");
        require(watchdog_ != address(0), "Invalid watchdog address");

        raffleToken = IERC20(raffleToken_);
        watchdog = watchdog_;
    }

    function updateWatchdog(address newWatchdog) external onlyOwner {
        require(newWatchdog != address(0), "Invalid watchdog");
        emit WatchdogUpdated(watchdog, newWatchdog);
        watchdog = newWatchdog;
    }

    function setRaffleToken(address newToken) external onlyOwner {
        require(newToken != address(0), "Invalid token address");
        emit RaffleTokenUpdated(address(raffleToken), newToken);
        raffleToken = IERC20(newToken);
    }

    function setUserRaffleFee(uint256 newFee) external onlyOwner {
        emit UserRaffleFeeUpdated(userRaffleFee, newFee);
        userRaffleFee = newFee;
    }

    function createRaffleWithToken(
        address prizeToken_,
        uint256[] calldata prizeAmounts_
    ) external onlyOwnerOrWatchdog whenNotPaused nonReentrant returns (uint256) {
        return _createTokenRaffle(prizeToken_, prizeAmounts_, RaffleState.CREATED);
    }

    function createAndActivateTokenRaffle(
        address prizeToken_,
        uint256[] calldata prizeAmounts_
    ) external onlyOwnerOrWatchdog whenNotPaused nonReentrant returns (uint256) {
        return _createTokenRaffle(prizeToken_, prizeAmounts_, RaffleState.ACTIVE);
    }

    /**
     * @notice Permissionless raffle creation for regular users.
     * @dev Caller escrows the ERC20 prize and sets a close time. The raffle goes ACTIVE
     *      immediately. It can only be ended (by owner/watchdog cron) once `endTime_` passes,
     *      so the owner cannot rug a user raffle early. Entry proceeds go to the creator.
     *      NFT prizes are intentionally not supported here yet — token prizes only.
     * @param prizeToken_   ERC20 token used as the prize (escrowed from msg.sender).
     * @param prizeAmounts_ One entry per prize slot; sum is pulled from msg.sender.
     * @param endTime_      Unix timestamp after which the raffle may be ended.
     */
    function createRaffleByUser(
        address prizeToken_,
        uint256[] calldata prizeAmounts_,
        uint256 endTime_
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(endTime_ > block.timestamp, "End time must be in the future");

        _collectUserFee();

        uint256 raffleId = _createTokenRaffle(prizeToken_, prizeAmounts_, RaffleState.ACTIVE);

        Raffle storage raffle = raffles[raffleId];
        raffle.creator = msg.sender;
        raffle.endTime = endTime_;

        emit UserRaffleCreated(raffleId, msg.sender, endTime_);
        return raffleId;
    }

    /**
     * @notice Permissionless NFT raffle creation for regular users.
     * @dev Mirrors {createRaffleByUser} but escrows ERC721/ERC6220 prizes. The caller
     *      must have approved this contract for the token ids (approve per token or
     *      setApprovalForAll). The raffle goes ACTIVE immediately and can only be ended
     *      (by owner/watchdog cron) once `endTime_` passes, so the owner cannot rug it.
     * @param prizeType_     ERC721 or ERC6220 (ERC20 is rejected).
     * @param prizeToken_    NFT collection address; the token ids are escrowed from msg.sender.
     * @param prizeTokenIds_ One token id per prize slot.
     * @param endTime_       Unix timestamp after which the raffle may be ended.
     */
    function createRaffleByUserWithNFT(
        PrizeType prizeType_,
        address prizeToken_,
        uint256[] calldata prizeTokenIds_,
        uint256 endTime_
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(endTime_ > block.timestamp, "End time must be in the future");

        _collectUserFee();

        uint256 raffleId = _createNftRaffle(prizeType_, prizeToken_, prizeTokenIds_, RaffleState.ACTIVE);

        Raffle storage raffle = raffles[raffleId];
        raffle.creator = msg.sender;
        raffle.endTime = endTime_;

        emit UserRaffleCreated(raffleId, msg.sender, endTime_);
        return raffleId;
    }

    function createRaffleWithNFT(
        PrizeType prizeType_,
        address prizeToken_,
        uint256[] calldata prizeTokenIds_
    ) external onlyOwnerOrWatchdog whenNotPaused nonReentrant returns (uint256) {
        return _createNftRaffle(prizeType_, prizeToken_, prizeTokenIds_, RaffleState.CREATED);
    }

    function createAndActivateNFTRaffle(
        PrizeType prizeType_,
        address prizeToken_,
        uint256[] calldata prizeTokenIds_
    ) external onlyOwnerOrWatchdog whenNotPaused nonReentrant returns (uint256) {
        return _createNftRaffle(prizeType_, prizeToken_, prizeTokenIds_, RaffleState.ACTIVE);
    }

    function activateRaffle(uint256 raffleId_)
        external
        onlyOwnerOrWatchdog
        raffleExists(raffleId_)
        raffleInState(raffleId_, RaffleState.CREATED)
    {
        raffles[raffleId_].state = RaffleState.ACTIVE;
        emit RaffleStateChanged(raffleId_, RaffleState.CREATED, RaffleState.ACTIVE);
    }

    function joinRaffle(uint256 raffleId_, uint256 tokenAmount_)
        external
        raffleExists(raffleId_)
        raffleInState(raffleId_, RaffleState.ACTIVE)
        whenNotPaused
        nonReentrant
    {
        require(tokenAmount_ > 0, "Invalid token amount");
        address beneficiary = raffles[raffleId_].creator;
        if (beneficiary == address(0)) beneficiary = owner();
        raffleToken.safeTransferFrom(msg.sender, beneficiary, tokenAmount_);
        emit EntrySubmitted(raffleId_, msg.sender, tokenAmount_);
    }

    function endRaffle(
        uint256 raffleId_,
        address[] calldata participants_,
        uint256[] calldata ticketCounts_,
        uint256 randomSeed_
    )
        external
        onlyOwnerOrWatchdog
        raffleExists(raffleId_)
        raffleInState(raffleId_, RaffleState.ACTIVE)
        whenNotPaused
        nonReentrant
    {
        require(participants_.length == ticketCounts_.length, "Array mismatch");

        Raffle storage raffle = raffles[raffleId_];
        uint256 prizeCount = raffle.prizeCount;
        require(prizeCount > 0, "No prizes");

        // User raffles can only be ended once their scheduled time passes (anti-rug).
        if (raffle.endTime != 0) {
            require(block.timestamp >= raffle.endTime, "Raffle not yet ended");
        }

        if (participants_.length == 0) {
            raffle.state = RaffleState.COMPLETED;

            // No entrants: return the escrowed prize to the creator of a user raffle.
            if (raffle.creator != address(0)) {
                if (raffle.isNFT) {
                    uint256[] storage tokenIds = rafflePrizeTokenIds[raffleId_];
                    for (uint256 i = 0; i < tokenIds.length; i++) {
                        IERC721(raffle.prizeToken).transferFrom(address(this), raffle.creator, tokenIds[i]);
                    }
                    emit CreatorRefunded(raffleId_, raffle.creator, 0);
                } else {
                    uint256[] storage amounts = rafflePrizeAmounts[raffleId_];
                    uint256 totalAmount = 0;
                    for (uint256 i = 0; i < amounts.length; i++) {
                        totalAmount += amounts[i];
                    }
                    if (totalAmount > 0) {
                        IERC20(raffle.prizeToken).safeTransfer(raffle.creator, totalAmount);
                        emit CreatorRefunded(raffleId_, raffle.creator, totalAmount);
                    }
                }
            }

            emit RaffleStateChanged(raffleId_, RaffleState.ACTIVE, RaffleState.COMPLETED);
            emit RaffleEnded(raffleId_, new address[](0), 0, 0);
            return;
        }

        (address[] memory winners, uint256 totalTickets) = _selectWinners(
            raffleId_,
            participants_,
            ticketCounts_,
            prizeCount,
            randomSeed_
        );

        raffle.state = RaffleState.COMPLETED;
        raffle.hasWinners = winners.length > 0;
        emit RaffleStateChanged(raffleId_, RaffleState.ACTIVE, RaffleState.COMPLETED);

        for (uint256 i = 0; i < winners.length; i++) {
            raffleWinners[raffleId_].push(winners[i]);
            _transferPrize(raffleId_, winners[i], i);
        }

        emit RaffleEnded(raffleId_, winners, participants_.length, totalTickets);
    }

    function refundNFT(uint256 raffleId_, address recipient)
        external
        onlyOwnerOrWatchdog
        raffleExists(raffleId_)
        nonReentrant
    {
        require(recipient != address(0), "Invalid recipient");
        Raffle storage raffle = raffles[raffleId_];
        require(raffle.state == RaffleState.COMPLETED, "Raffle not completed");
        require(!raffle.hasWinners, "Raffle has winners");
        require(raffle.isNFT, "Not NFT raffle");

        uint256[] storage tokenIds = rafflePrizeTokenIds[raffleId_];
        for (uint256 i = 0; i < tokenIds.length; i++) {
            IERC721(raffle.prizeToken).transferFrom(address(this), recipient, tokenIds[i]);
        }

        emit EmergencyWithdraw(raffleId_, recipient, raffle.prizeToken);
    }

    function refundToken(uint256 raffleId_, address recipient)
        external
        onlyOwnerOrWatchdog
        raffleExists(raffleId_)
        nonReentrant
    {
        require(recipient != address(0), "Invalid recipient");
        Raffle storage raffle = raffles[raffleId_];
        require(raffle.state == RaffleState.COMPLETED, "Raffle not completed");
        require(!raffle.hasWinners, "Raffle has winners");
        require(!raffle.isNFT, "Not token raffle");

        uint256[] storage amounts = rafflePrizeAmounts[raffleId_];
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        IERC20(raffle.prizeToken).safeTransfer(recipient, totalAmount);

        emit EmergencyWithdraw(raffleId_, recipient, raffle.prizeToken);
    }

    function emergencyWithdraw(uint256 raffleId_, address recipient)
        external
        onlyOwnerOrWatchdog
        raffleExists(raffleId_)
        nonReentrant
    {
        require(recipient != address(0), "Invalid recipient");
        Raffle storage raffle = raffles[raffleId_];
        require(raffle.state != RaffleState.COMPLETED, "Raffle completed");
        require(raffle.state != RaffleState.CANCELLED, "Already cancelled");

        RaffleState oldState = raffle.state;
        raffle.state = RaffleState.CANCELLED;
        emit RaffleStateChanged(raffleId_, oldState, RaffleState.CANCELLED);

        if (raffle.isNFT) {
            uint256[] storage tokenIds = rafflePrizeTokenIds[raffleId_];
            for (uint256 i = 0; i < tokenIds.length; i++) {
                IERC721(raffle.prizeToken).transferFrom(address(this), recipient, tokenIds[i]);
            }
        } else {
            uint256[] storage amounts = rafflePrizeAmounts[raffleId_];
            uint256 totalAmount = 0;
            for (uint256 i = 0; i < amounts.length; i++) {
                totalAmount += amounts[i];
            }
            IERC20(raffle.prizeToken).safeTransfer(recipient, totalAmount);
        }

        emit EmergencyWithdraw(raffleId_, recipient, raffle.prizeToken);
    }

    function getPrizeAmounts(uint256 raffleId_) external view returns (uint256[] memory) {
        return rafflePrizeAmounts[raffleId_];
    }

    function getPrizeTokenIds(uint256 raffleId_) external view returns (uint256[] memory) {
        return rafflePrizeTokenIds[raffleId_];
    }

    function getWinners(uint256 raffleId_) external view returns (address[] memory) {
        return raffleWinners[raffleId_];
    }

    function getRaffleInfo(uint256 raffleId_)
        external
        view
        returns (
            PrizeType prizeType,
            address prizeToken,
            uint256 prizeCount,
            RaffleState state,
            bool isNFT,
            bool hasWinners
        )
    {
        Raffle memory raffle = raffles[raffleId_];
        return (
            raffle.prizeType,
            raffle.prizeToken,
            raffle.prizeCount,
            raffle.state,
            raffle.isNFT,
            raffle.hasWinners
        );
    }

    function getRaffleState(uint256 raffleId_) external view returns (RaffleState) {
        return raffles[raffleId_].state;
    }

    /**
     * @notice Read the creator and scheduled close time of a raffle.
     * @return creator address(0) for owner/platform raffles, else the user who created it.
     * @return endTime 0 for owner-managed raffles, else the unix time after which it may end.
     */
    function getRaffleSchedule(uint256 raffleId_) external view returns (address creator, uint256 endTime) {
        Raffle memory raffle = raffles[raffleId_];
        return (raffle.creator, raffle.endTime);
    }

    /**
     * @notice True once a scheduled (user) raffle has passed its close time and is still active.
     * @dev Off-chain cron pulls ACTIVE raffles and ends those where this returns true.
     */
    function isRaffleEndable(uint256 raffleId_) external view returns (bool) {
        Raffle memory raffle = raffles[raffleId_];
        if (raffle.state != RaffleState.ACTIVE) return false;
        if (raffle.endTime == 0) return false;
        return block.timestamp >= raffle.endTime;
    }

    function isRaffleActive(uint256 raffleId_) external view returns (bool) {
        return raffles[raffleId_].state == RaffleState.ACTIVE;
    }

    function pause() external onlyOwnerOrWatchdog {
        _pause();
    }

    function unpause() external onlyOwnerOrWatchdog {
        _unpause();
    }

    function _collectUserFee() internal {
        if (userRaffleFee > 0) {
            raffleToken.safeTransferFrom(msg.sender, owner(), userRaffleFee);
        }
    }

    function _createTokenRaffle(
        address prizeToken_,
        uint256[] calldata prizeAmounts_,
        RaffleState initialState_
    ) internal returns (uint256) {
        require(prizeToken_ != address(0), "Invalid prize token");
        require(prizeAmounts_.length > 0, "Prize amounts required");

        raffleCounter++;
        uint256 raffleId = raffleCounter;

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < prizeAmounts_.length; i++) {
            require(prizeAmounts_[i] > 0, "Prize amount required");
            rafflePrizeAmounts[raffleId].push(prizeAmounts_[i]);
            totalAmount += prizeAmounts_[i];
        }

        IERC20(prizeToken_).safeTransferFrom(msg.sender, address(this), totalAmount);

        raffles[raffleId] = Raffle({
            prizeType: PrizeType.ERC20,
            prizeToken: prizeToken_,
            state: initialState_,
            prizeCount: prizeAmounts_.length,
            isNFT: false,
            hasWinners: false,
            creator: address(0),
            endTime: 0
        });

        emit RaffleCreated(raffleId, prizeToken_, prizeAmounts_.length, false);
        emit RaffleStateChanged(raffleId, RaffleState.CREATED, initialState_);

        return raffleId;
    }

    function _createNftRaffle(
        PrizeType prizeType_,
        address prizeToken_,
        uint256[] calldata prizeTokenIds_,
        RaffleState initialState_
    ) internal returns (uint256) {
        require(prizeType_ != PrizeType.ERC20, "Prize type must be NFT");
        require(prizeToken_ != address(0), "Invalid prize token");
        require(prizeTokenIds_.length > 0, "Token IDs required");

        raffleCounter++;
        uint256 raffleId = raffleCounter;

        for (uint256 i = 0; i < prizeTokenIds_.length; i++) {
            require(prizeTokenIds_[i] > 0, "Token ID required");
            rafflePrizeTokenIds[raffleId].push(prizeTokenIds_[i]);
            IERC721(prizeToken_).transferFrom(msg.sender, address(this), prizeTokenIds_[i]);
        }

        raffles[raffleId] = Raffle({
            prizeType: prizeType_,
            prizeToken: prizeToken_,
            state: initialState_,
            prizeCount: prizeTokenIds_.length,
            isNFT: true,
            hasWinners: false,
            creator: address(0),
            endTime: 0
        });

        emit RaffleCreated(raffleId, prizeToken_, prizeTokenIds_.length, true);
        emit RaffleStateChanged(raffleId, RaffleState.CREATED, initialState_);

        return raffleId;
    }

    function _generateRandomNumber(
        uint256 randomSeed_,
        uint256 prizeIndex_,
        uint256 remainingTicketsTotal_
    ) internal view returns (uint256) {
        return uint256(
            keccak256(
                abi.encodePacked(
                    randomSeed_,
                    prizeIndex_,
                    block.timestamp,
                    block.prevrandao,
                    blockhash(block.number - 1),
                    remainingTicketsTotal_
                )
            )
        );
    }

    function _findWinner(
        uint256[] memory remainingTickets,
        uint256 randomTicket
    ) internal pure returns (uint256) {
        uint256 cumulative = 0;
        for (uint256 i = 0; i < remainingTickets.length; i++) {
            uint256 tickets = remainingTickets[i];
            if (tickets == 0) continue;
            cumulative += tickets;
            if (randomTicket < cumulative) return i;
        }
        revert("Winner selection failed");
    }

    function _selectWinners(
        uint256 raffleId_,
        address[] calldata participants_,
        uint256[] calldata ticketCounts_,
        uint256 prizeCount_,
        uint256 randomSeed_
    ) internal view returns (address[] memory, uint256) {
        uint256[] memory remainingTickets = new uint256[](ticketCounts_.length);
        uint256 totalTickets = 0;
        uint256 eligibleParticipants = 0;

        for (uint256 i = 0; i < ticketCounts_.length; i++) {
            remainingTickets[i] = ticketCounts_[i];
            if (ticketCounts_[i] > 0) {
                totalTickets += ticketCounts_[i];
                eligibleParticipants++;
            }
        }

        require(totalTickets > 0, "No tickets");
        require(eligibleParticipants >= prizeCount_, "Not enough participants");

        uint256 remainingTicketsTotal = totalTickets;
        address[] memory winners = new address[](prizeCount_);

        for (uint256 prizeIndex = 0; prizeIndex < prizeCount_; prizeIndex++) {
            uint256 randomNumber = _generateRandomNumber(randomSeed_, prizeIndex, remainingTicketsTotal);
            uint256 winnerIndex = _findWinner(remainingTickets, randomNumber % remainingTicketsTotal);

            winners[prizeIndex] = participants_[winnerIndex];
            remainingTicketsTotal -= remainingTickets[winnerIndex];
            remainingTickets[winnerIndex] = 0;
        }

        raffleId_; // Silence unused variable warning
        return (winners, totalTickets);
    }

    function _transferPrize(uint256 raffleId_, address winner_, uint256 prizeIndex_) internal {
        Raffle storage raffle = raffles[raffleId_];

        if (raffle.isNFT) {
            uint256 tokenId = rafflePrizeTokenIds[raffleId_][prizeIndex_];
            IERC721(raffle.prizeToken).transferFrom(address(this), winner_, tokenId);
            emit PrizeDistributed(raffleId_, winner_, tokenId);
        } else {
            uint256 amount = rafflePrizeAmounts[raffleId_][prizeIndex_];
            IERC20(raffle.prizeToken).safeTransfer(winner_, amount);
            emit PrizeDistributed(raffleId_, winner_, amount);
        }
    }
}
