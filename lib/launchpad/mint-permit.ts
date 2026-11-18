/**
 * Shared shape of the one-mint-per-network permit.
 *
 * The contract (`AriwaNFT.sol`) verifies an EIP-712
 * `MintPermit(bytes32 ipHash, address wallet)` signature produced by the
 * server. The wallet field stops a copied permit from being submitted by
 * someone else; the ipHash is what enforces one mint per network. Keeping the
 * domain and type here means the browser and the route handler can never drift
 * apart.
 *
 * This module is intentionally free of secrets and server-only imports so a
 * client component can read the types.
 */

export const MINT_PERMIT_DOMAIN_NAME = "ARIWA NFT";
export const MINT_PERMIT_DOMAIN_VERSION = "1";

export const MINT_PERMIT_TYPES = {
  MintPermit: [
    { name: "ipHash", type: "bytes32" },
    { name: "wallet", type: "address" },
  ],
} as const;

/** What `/api/launchpad/mint-permit` returns on success. */
export type MintPermit = {
  ipHash: `0x${string}`;
  signature: `0x${string}`;
  signer: `0x${string}`;
  verifyingContract: `0x${string}`;
  chainId: number;
};

/** Whether the current network already used its mint. */
export type IpMintStatus = {
  used: boolean;
  ipHash: `0x${string}` | null;
  configured: boolean;
};

export type MintPermitErrorCode =
  | "not_configured"
  | "already_minted"
  | "unavailable";
