import { createPublicClient, http, parseAbi, getAddress, formatUnits } from "viem";
import { giwaSepolia } from "@/lib/contracts";

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
]);

const erc721Abi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
]);

export type VerificationResult = {
  isValid: boolean;
  error?: string;
  details?: {
    name?: string;
    symbol?: string;
    balance?: string;
    decimals?: number;
    ownerAddress?: string;
  };
};

export async function verifyERC20Token(
  tokenAddress: string,
  requiredAmount: bigint,
  ownerAddress: string
): Promise<VerificationResult> {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io";
    const publicClient = createPublicClient({
      chain: giwaSepolia,
      transport: http(rpcUrl),
    });

    const normalizedAddress = getAddress(tokenAddress.toLowerCase() as `0x${string}`);

    // Check if address is a contract
    const bytecode = await publicClient.getBytecode({ address: normalizedAddress });
    if (!bytecode || bytecode === "0x") {
      return {
        isValid: false,
        error: "Address is not a contract",
      };
    }

    // Try to read ERC20 functions
    let name: string;
    let symbol: string;
    let decimals: number;
    let balance: bigint;

    try {
      [name, symbol, decimals, balance] = await Promise.all([
        publicClient.readContract({
          address: normalizedAddress,
          abi: erc20Abi,
          functionName: "name",
        }),
        publicClient.readContract({
          address: normalizedAddress,
          abi: erc20Abi,
          functionName: "symbol",
        }),
        publicClient.readContract({
          address: normalizedAddress,
          abi: erc20Abi,
          functionName: "decimals",
        }),
        publicClient.readContract({
          address: normalizedAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [ownerAddress as `0x${string}`],
        }),
      ]);
    } catch (error) {
      return {
        isValid: false,
        error: "Not a valid ERC20 token contract",
      };
    }

    // Check if owner has sufficient balance
    if (balance < requiredAmount) {
      // Format balance for human-readable display
      const formattedBalance = formatUnits(balance, decimals);
      const formattedRequired = formatUnits(requiredAmount, decimals);
      
      return {
        isValid: false,
        error: `Insufficient balance. Required: ${formattedRequired} ${symbol}, Available: ${formattedBalance} ${symbol}`,
        details: {
          name,
          symbol,
          decimals,
          balance: formattedBalance,
        },
      };
    }

    // Format balance for human-readable display
    const formattedBalance = formatUnits(balance, decimals);

    return {
      isValid: true,
      details: {
        name,
        symbol,
        decimals,
        balance: formattedBalance,
      },
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function verifyERC721Token(
  tokenAddress: string,
  tokenIds: bigint[],
  ownerAddress: string
): Promise<VerificationResult> {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io";
    const publicClient = createPublicClient({
      chain: giwaSepolia,
      transport: http(rpcUrl),
    });

    const normalizedAddress = getAddress(tokenAddress.toLowerCase() as `0x${string}`);

    // Check if address is a contract
    const bytecode = await publicClient.getBytecode({ address: normalizedAddress });
    if (!bytecode || bytecode === "0x") {
      return {
        isValid: false,
        error: "Address is not a contract",
      };
    }

    // Try to read ERC721 functions
    let name: string;
    let symbol: string;

    try {
      [name, symbol] = await Promise.all([
        publicClient.readContract({
          address: normalizedAddress,
          abi: erc721Abi,
          functionName: "name",
        }),
        publicClient.readContract({
          address: normalizedAddress,
          abi: erc721Abi,
          functionName: "symbol",
        }),
      ]);
    } catch (error) {
      return {
        isValid: false,
        error: "Not a valid ERC721 token contract",
      };
    }

    // Check ownership of all token IDs
    const ownershipChecks = await Promise.all(
      tokenIds.map(async (tokenId) => {
        try {
          const owner = await publicClient.readContract({
            address: normalizedAddress,
            abi: erc721Abi,
            functionName: "ownerOf",
            args: [tokenId],
          });
          return {
            tokenId: tokenId.toString(),
            owner,
            isOwned: owner.toLowerCase() === ownerAddress.toLowerCase(),
          };
        } catch (error) {
          return {
            tokenId: tokenId.toString(),
            owner: null,
            isOwned: false,
            error: "Token does not exist or error reading ownership",
          };
        }
      })
    );

    const notOwnedTokens = ownershipChecks.filter((check) => !check.isOwned);

    if (notOwnedTokens.length > 0) {
      const errorMessages = notOwnedTokens.map((token) => {
        if (token.error) {
          return `Token ID ${token.tokenId}: ${token.error}`;
        }
        return `Token ID ${token.tokenId}: Owned by ${token.owner}, not ${ownerAddress}`;
      });

      return {
        isValid: false,
        error: `Some tokens are not owned by the specified address:\n${errorMessages.join("\n")}`,
        details: {
          name,
          symbol,
        },
      };
    }

    return {
      isValid: true,
      details: {
        name,
        symbol,
        ownerAddress,
      },
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
