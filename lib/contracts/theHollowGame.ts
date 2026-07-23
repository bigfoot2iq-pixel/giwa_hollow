// TheHollowGame Contract ABI and Config
// Deploy the contract from contracts/TheHollowGame.sol and update the address below

export const THE_HOLLOW_GAME_ADDRESS = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000';

export const THE_HOLLOW_GAME_ABI = [
  {"inputs": [],"stateMutability": "nonpayable","type": "constructor"},
  {"inputs": [{"internalType": "address","name": "owner","type": "address"}],"name": "OwnableInvalidOwner","type": "error"},
  {"inputs": [{"internalType": "address","name": "account","type": "address"}],"name": "OwnableUnauthorizedAccount","type": "error"},
  {"inputs": [],"name": "ReentrancyGuardReentrantCall","type": "error"},
  {"anonymous": false,"inputs": [{"indexed": true,"internalType": "address","name": "owner","type": "address"},{"indexed": false,"internalType": "uint256","name": "amount","type": "uint256"}],"name": "FundsWithdrawn","type": "event"},
  {"anonymous": false,"inputs": [{"indexed": true,"internalType": "address","name": "previousOwner","type": "address"},{"indexed": true,"internalType": "address","name": "newOwner","type": "address"}],"name": "OwnershipTransferred","type": "event"},
  {"anonymous": false,"inputs": [{"indexed": false,"internalType": "uint256","name": "oldPrice","type": "uint256"},{"indexed": false,"internalType": "uint256","name": "newPrice","type": "uint256"}],"name": "PlayPriceUpdated","type": "event"},
  {"anonymous": false,"inputs": [{"indexed": true,"internalType": "address","name": "player","type": "address"},{"indexed": false,"internalType": "uint256","name": "amount","type": "uint256"},{"indexed": false,"internalType": "uint256","name": "timestamp","type": "uint256"}],"name": "PlayPurchased","type": "event"},
  {"inputs": [],"name": "getBalance","outputs": [{"internalType": "uint256","name": "","type": "uint256"}],"stateMutability": "view","type": "function"},
  {"inputs": [],"name": "getPlayPrice","outputs": [{"internalType": "uint256","name": "","type": "uint256"}],"stateMutability": "view","type": "function"},
  {"inputs": [],"name": "owner","outputs": [{"internalType": "address","name": "","type": "address"}],"stateMutability": "view","type": "function"},
  {"inputs": [],"name": "payToPlay","outputs": [],"stateMutability": "payable","type": "function"},
  {"inputs": [],"name": "playPrice","outputs": [{"internalType": "uint256","name": "","type": "uint256"}],"stateMutability": "view","type": "function"},
  {"inputs": [],"name": "renounceOwnership","outputs": [],"stateMutability": "nonpayable","type": "function"},
  {"inputs": [{"internalType": "uint256","name": "_newPrice","type": "uint256"}],"name": "setPlayPrice","outputs": [],"stateMutability": "nonpayable","type": "function"},
  {"inputs": [{"internalType": "address","name": "newOwner","type": "address"}],"name": "transferOwnership","outputs": [],"stateMutability": "nonpayable","type": "function"},
  {"inputs": [],"name": "withdraw","outputs": [],"stateMutability": "nonpayable","type": "function"},
  {"stateMutability": "payable","type": "receive"}
] as const;
