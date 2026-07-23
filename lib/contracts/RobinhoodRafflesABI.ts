export const RobinhoodRafflesABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "raffleToken_",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "watchdog_",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "EnforcedPause",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ExpectedPause",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "SafeERC20FailedOperation",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "raffleId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "CreatorRefunded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "raffleId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "prizeToken",
        "type": "address"
      }
    ],
    "name": "EmergencyWithdraw",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "raffleId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "participant",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "tokensSpent",
        "type": "uint256"
      }
    ],
    "name": "EntrySubmitted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Paused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "raffleId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "winner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "prizeValue",
        "type": "uint256"
      }
    ],
    "name": "PrizeDistributed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "raffleId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "prizeToken",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "prizeCount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "isNFT",
        "type": "bool"
      }
    ],
    "name": "RaffleCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "raffleId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address[]",
        "name": "winners",
        "type": "address[]"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalParticipants",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalTickets",
        "type": "uint256"
      }
    ],
    "name": "RaffleEnded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "raffleId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "enum RobinhoodRaffles.RaffleState",
        "name": "oldState",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "enum RobinhoodRaffles.RaffleState",
        "name": "newState",
        "type": "uint8"
      }
    ],
    "name": "RaffleStateChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "oldToken",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "newToken",
        "type": "address"
      }
    ],
    "name": "RaffleTokenUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Unpaused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "raffleId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "endTime",
        "type": "uint256"
      }
    ],
    "name": "UserRaffleCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "oldWatchdog",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "newWatchdog",
        "type": "address"
      }
    ],
    "name": "WatchdogUpdated",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      }
    ],
    "name": "activateRaffle",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum RobinhoodRaffles.PrizeType",
        "name": "prizeType_",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "prizeToken_",
        "type": "address"
      },
      {
        "internalType": "uint256[]",
        "name": "prizeTokenIds_",
        "type": "uint256[]"
      }
    ],
    "name": "createAndActivateNFTRaffle",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "prizeToken_",
        "type": "address"
      },
      {
        "internalType": "uint256[]",
        "name": "prizeAmounts_",
        "type": "uint256[]"
      }
    ],
    "name": "createAndActivateTokenRaffle",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "prizeToken_",
        "type": "address"
      },
      {
        "internalType": "uint256[]",
        "name": "prizeAmounts_",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256",
        "name": "endTime_",
        "type": "uint256"
      }
    ],
    "name": "createRaffleByUser",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum RobinhoodRaffles.PrizeType",
        "name": "prizeType_",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "prizeToken_",
        "type": "address"
      },
      {
        "internalType": "uint256[]",
        "name": "prizeTokenIds_",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256",
        "name": "endTime_",
        "type": "uint256"
      }
    ],
    "name": "createRaffleByUserWithNFT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum RobinhoodRaffles.PrizeType",
        "name": "prizeType_",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "prizeToken_",
        "type": "address"
      },
      {
        "internalType": "uint256[]",
        "name": "prizeTokenIds_",
        "type": "uint256[]"
      }
    ],
    "name": "createRaffleWithNFT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "prizeToken_",
        "type": "address"
      },
      {
        "internalType": "uint256[]",
        "name": "prizeAmounts_",
        "type": "uint256[]"
      }
    ],
    "name": "createRaffleWithToken",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      }
    ],
    "name": "emergencyWithdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      },
      {
        "internalType": "address[]",
        "name": "participants_",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "ticketCounts_",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256",
        "name": "randomSeed_",
        "type": "uint256"
      }
    ],
    "name": "endRaffle",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      }
    ],
    "name": "getPrizeAmounts",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      }
    ],
    "name": "getPrizeTokenIds",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      }
    ],
    "name": "getRaffleInfo",
    "outputs": [
      {
        "internalType": "enum RobinhoodRaffles.PrizeType",
        "name": "prizeType",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "prizeToken",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "prizeCount",
        "type": "uint256"
      },
      {
        "internalType": "enum RobinhoodRaffles.RaffleState",
        "name": "state",
        "type": "uint8"
      },
      {
        "internalType": "bool",
        "name": "isNFT",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "hasWinners",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      }
    ],
    "name": "getRaffleSchedule",
    "outputs": [
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "endTime",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      }
    ],
    "name": "getRaffleState",
    "outputs": [
      {
        "internalType": "enum RobinhoodRaffles.RaffleState",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      }
    ],
    "name": "getWinners",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      }
    ],
    "name": "isRaffleActive",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      }
    ],
    "name": "isRaffleEndable",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "tokenAmount_",
        "type": "uint256"
      }
    ],
    "name": "joinRaffle",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "raffleCounter",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "raffleToken",
    "outputs": [
      {
        "internalType": "contract IERC20",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "raffles",
    "outputs": [
      {
        "internalType": "enum RobinhoodRaffles.PrizeType",
        "name": "prizeType",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "prizeToken",
        "type": "address"
      },
      {
        "internalType": "enum RobinhoodRaffles.RaffleState",
        "name": "state",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "prizeCount",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "isNFT",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "hasWinners",
        "type": "bool"
      },
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "endTime",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      }
    ],
    "name": "refundNFT",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "raffleId_",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      }
    ],
    "name": "refundToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newToken",
        "type": "address"
      }
    ],
    "name": "setRaffleToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newWatchdog",
        "type": "address"
      }
    ],
    "name": "updateWatchdog",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "watchdog",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

