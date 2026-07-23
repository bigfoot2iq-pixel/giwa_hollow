export type PrizeType = "erc20" | "erc721" | "erc6220";
export type RaffleStatus = "pending" | "active" | "ended";

export interface RaffleRow {
  id: string;
  chain_raffle_id: number | null;
  title: string;
  slug: string;
  description: string;
  image_url: string | null;
  tokens_required: number;
  max_entries_per_user: number;
  max_participants: number;
  start_date: string;
  end_date: string;
  tx_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrizeRow {
  id: string;
  raffle_id: string;
  prize_type: PrizeType;
  prize_token_address: string;
  prize_amount: string | null;
  prize_token_id: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      litvm_raffle_raffles: {
        Row: RaffleRow;
        Insert: Omit<RaffleRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<RaffleRow, "id" | "created_at" | "updated_at">>;
      };
      litvm_raffle_prizes: {
        Row: PrizeRow;
        Insert: Omit<PrizeRow, "id" | "created_at">;
        Update: Partial<Omit<PrizeRow, "id" | "created_at">>;
      };
      litvm_raffle_entries: {
        Row: {
          id: string;
          raffle_id: string;
          wallet_address: string;
          tokens_spent: number;
          entry_count: number;
          tx_hash: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["litvm_raffle_entries"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["litvm_raffle_entries"]["Insert"]>;
      };
      litvm_raffle_winners: {
        Row: {
          id: string;
          raffle_id: string;
          wallet_address: string;
          prize_amount: string | null;
          prize_token_id: string | null;
          distribution_tx_hash: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["litvm_raffle_winners"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["litvm_raffle_winners"]["Insert"]>;
      };
      litvm_raffle_users: {
        Row: {
          id: string;
          wallet_address: string;
          total_entries: number;
          total_wins: number;
          id_waitlisted: boolean;
          free_mint_reserved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["litvm_raffle_users"]["Row"],
          "id" | "created_at" | "updated_at" | "total_entries" | "total_wins"
        >;
        Update: Partial<Database["public"]["Tables"]["litvm_raffle_users"]["Insert"]>;
      };
      litvm_raffle_transactions: {
        Row: {
          id: string;
          wallet_address: string;
          type: "token_purchase" | "raffle_entry" | "prize_distribution";
          amount: string;
          tx_hash: string;
          raffle_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["litvm_raffle_transactions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["litvm_raffle_transactions"]["Insert"]>;
      };
      litvm_raffle_admin_logs: {
        Row: {
          id: string;
          admin_wallet: string;
          action: string;
          details: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["litvm_raffle_admin_logs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["litvm_raffle_admin_logs"]["Insert"]>;
      };
      litvm_raffle_admin: {
        Row: {
          wallet_address: string;
        };
        Insert: Database["public"]["Tables"]["litvm_raffle_admin"]["Row"];
        Update: Partial<Database["public"]["Tables"]["litvm_raffle_admin"]["Row"]>;
      };
    };
  };
}

export type Raffle = Database["public"]["Tables"]["litvm_raffle_raffles"]["Row"];
export type Entry = Database["public"]["Tables"]["litvm_raffle_entries"]["Row"];
export type Winner = Database["public"]["Tables"]["litvm_raffle_winners"]["Row"];
export type User = Database["public"]["Tables"]["litvm_raffle_users"]["Row"];
export type Transaction = Database["public"]["Tables"]["litvm_raffle_transactions"]["Row"];
export type AdminLog = Database["public"]["Tables"]["litvm_raffle_admin_logs"]["Row"];
export type AdminWallet = Database["public"]["Tables"]["litvm_raffle_admin"]["Row"];
export type Prize = Database["public"]["Tables"]["litvm_raffle_prizes"]["Row"];

// Game-related types
export type WalletType = 'evm';

export interface TheHollowUser {
  id: string;
  wallet_address: string;
  wallet_type: WalletType;
  username: string;
  is_registered: boolean;
  is_whitelisted: boolean;
  x_username?: string;
  x_avatar_url?: string;
  x_user_id?: string;
  image_url?: string;
  game_score?: number;
  created_at: string;
  updated_at: string;
}

export interface UserRegistrationData {
  username: string;
  imageFile?: File;
  removeImage?: boolean;
}

export interface WhitelistRequest {
  wallet_address: string;
  x_username: string;
  x_avatar_url?: string;
  x_user_id: string;
}

export interface WhitelistResponse {
  success: boolean;
  message: string;
  user?: TheHollowUser;
}

// X OAuth User Data
export interface XUserData {
  id: string;
  username: string;
  name: string;
  profile_image_url: string;
  verified?: boolean;
}

// X OAuth Session Storage
export interface XAuthSession {
  user: XUserData;
  authenticated: boolean;
  timestamp: number;
}

// X OAuth API Response
export interface XOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

// X OAuth User API Response
export interface XUserApiResponse {
  data: {
    id: string;
    username: string;
    name: string;
    profile_image_url?: string;
    verified?: boolean;
  };
}

// Leaderboard Types
export interface LeaderboardEntry {
  rank: number;
  wallet_address: string;
  username: string;
  avatar_url: string | null;
  image_url?: string | null;
  x_avatar_url?: string | null;
  game_score: number;
  is_registered: boolean;
}

export interface LeaderboardResponse {
  data: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ScoreUpdateResponse {
  success: boolean;
  updated: boolean;
  current_score: number;
  rank?: number;
  message: string;
}

// Game Session Types (Pay-to-Play)
export interface GameSession {
  sessionId: string;
  expiresAt: string;
  createdAt?: string;
}

export interface CreateSessionResponse {
  success: boolean;
  sessionId?: string;
  expiresAt?: string;
  error?: string;
}

export interface ActiveSessionResponse {
  success: boolean;
  hasActiveSession: boolean;
  sessionId?: string;
  expiresAt?: string;
  createdAt?: string;
}

export interface CompleteSessionResponse extends ScoreUpdateResponse {
  sessionCompleted: boolean;
  finalScore: number;
}
