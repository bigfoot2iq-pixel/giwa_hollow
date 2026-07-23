export const HollowTokenABI = [
	{
		"inputs": [
			{ "internalType": "string", "name": "name_", "type": "string" },
			{ "internalType": "string", "name": "symbol_", "type": "string" },
			{ "internalType": "uint256", "name": "claimCooldown_", "type": "uint256" }
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "spender", "type": "address" },
			{ "internalType": "uint256", "name": "allowance", "type": "uint256" },
			{ "internalType": "uint256", "name": "needed", "type": "uint256" }
		],
		"name": "ERC20InsufficientAllowance",
		"type": "error"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "sender", "type": "address" },
			{ "internalType": "uint256", "name": "balance", "type": "uint256" },
			{ "internalType": "uint256", "name": "needed", "type": "uint256" }
		],
		"name": "ERC20InsufficientBalance",
		"type": "error"
	},
	{
		"inputs": [{ "internalType": "address", "name": "approver", "type": "address" }],
		"name": "ERC20InvalidApprover",
		"type": "error"
	},
	{
		"inputs": [{ "internalType": "address", "name": "receiver", "type": "address" }],
		"name": "ERC20InvalidReceiver",
		"type": "error"
	},
	{
		"inputs": [{ "internalType": "address", "name": "sender", "type": "address" }],
		"name": "ERC20InvalidSender",
		"type": "error"
	},
	{
		"inputs": [{ "internalType": "address", "name": "spender", "type": "address" }],
		"name": "ERC20InvalidSpender",
		"type": "error"
	},
	{ "inputs": [], "name": "EnforcedPause", "type": "error" },
	{ "inputs": [], "name": "ExpectedPause", "type": "error" },
	{
		"inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
		"name": "OwnableInvalidOwner",
		"type": "error"
	},
	{
		"inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
		"name": "OwnableUnauthorizedAccount",
		"type": "error"
	},
	{ "inputs": [], "name": "ReentrancyGuardReentrantCall", "type": "error" },
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
			{ "indexed": true, "internalType": "address", "name": "spender", "type": "address" },
			{ "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
		],
		"name": "Approval",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "uint8", "name": "categoryId", "type": "uint8" },
			{ "indexed": false, "internalType": "string", "name": "name", "type": "string" },
			{ "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
			{ "indexed": false, "internalType": "uint256", "name": "fee", "type": "uint256" }
		],
		"name": "CategoryUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": false, "internalType": "uint256", "name": "oldCooldown", "type": "uint256" },
			{ "indexed": false, "internalType": "uint256", "name": "newCooldown", "type": "uint256" }
		],
		"name": "ClaimCooldownUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "to", "type": "address" },
			{ "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
		],
		"name": "FeesWithdrawn",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" },
			{ "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [{ "indexed": false, "internalType": "address", "name": "account", "type": "address" }],
		"name": "Paused",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "claimer", "type": "address" },
			{ "indexed": true, "internalType": "uint8", "name": "categoryId", "type": "uint8" },
			{ "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
			{ "indexed": false, "internalType": "uint256", "name": "feePaid", "type": "uint256" }
		],
		"name": "TokensClaimed",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "from", "type": "address" },
			{ "indexed": true, "internalType": "address", "name": "to", "type": "address" },
			{ "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
		],
		"name": "Transfer",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [{ "indexed": false, "internalType": "address", "name": "account", "type": "address" }],
		"name": "Unpaused",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "CATEGORY_COUNT",
		"outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "MAX_SUPPLY",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "owner", "type": "address" },
			{ "internalType": "address", "name": "spender", "type": "address" }
		],
		"name": "allowance",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "spender", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" }
		],
		"name": "approve",
		"outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
		"name": "balanceOf",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "uint256", "name": "value", "type": "uint256" }],
		"name": "burn",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "account", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" }
		],
		"name": "burnFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
		"name": "canClaim",
		"outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"name": "categoryAmount",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"name": "categoryFee",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"name": "categoryName",
		"outputs": [{ "internalType": "string", "name": "", "type": "string" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "claimCooldown",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "uint8", "name": "categoryId", "type": "uint8" }],
		"name": "claimTokens",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "decimals",
		"outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "uint8", "name": "categoryId", "type": "uint8" }],
		"name": "getCategoryAmount",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "uint8", "name": "categoryId", "type": "uint8" }],
		"name": "getCategoryFee",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "uint8", "name": "categoryId", "type": "uint8" }],
		"name": "getCategoryName",
		"outputs": [{ "internalType": "string", "name": "", "type": "string" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "uint8", "name": "categoryId", "type": "uint8" }],
		"name": "getClaimAmount",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
		"name": "getLastClaimTimestamp",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "address", "name": "", "type": "address" }],
		"name": "lastClaimTimestamp",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "amount", "type": "uint256" }
		],
		"name": "mint",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "name",
		"outputs": [{ "internalType": "string", "name": "", "type": "string" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [{ "internalType": "address", "name": "", "type": "address" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }],
		"name": "ownerWithdraw",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{ "inputs": [], "name": "pause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
	{
		"inputs": [],
		"name": "paused",
		"outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
		"stateMutability": "view",
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
			{ "internalType": "uint8", "name": "categoryId", "type": "uint8" },
			{ "internalType": "string", "name": "name", "type": "string" },
			{ "internalType": "uint256", "name": "amount", "type": "uint256" },
			{ "internalType": "uint256", "name": "fee", "type": "uint256" }
		],
		"name": "setCategory",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "uint256", "name": "newCooldown", "type": "uint256" }],
		"name": "setClaimCooldown",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "symbol",
		"outputs": [{ "internalType": "string", "name": "", "type": "string" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalSupply",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" }
		],
		"name": "transfer",
		"outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "from", "type": "address" },
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" }
		],
		"name": "transferFrom",
		"outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{ "inputs": [], "name": "unpause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
	{
		"inputs": [{ "internalType": "address", "name": "to", "type": "address" }],
		"name": "withdrawFees",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{ "stateMutability": "payable", "type": "receive" }
] as const;
