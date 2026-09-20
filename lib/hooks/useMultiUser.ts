'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { TheAriwaUser, UserRegistrationData } from '@/lib/supabase/types';
import { getUserByWallet, updateUserRegistration } from '@/lib/utils/user';
import { buildProfileUpdateMessage } from '@/lib/utils/profileAuth';
import { clearXAuthSession } from '@/lib/utils/x-auth';

interface UseMultiUserReturn {
  user: TheAriwaUser | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  registerUser: (data: UserRegistrationData) => Promise<boolean>;
  needsRegistration: boolean;
}

export const useMultiUser = (): UseMultiUserReturn => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [user, setUser] = useState<TheAriwaUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once the first profile lookup for the current wallet has finished, so
  // "needs registration" is not reported before we know whether a row exists.
  const [loaded, setLoaded] = useState(false);

  const refreshUser = useCallback(async () => {
    if (!address || !isConnected) {
      setUser(null);
      setError(null);
      setLoaded(false);
      // Clear X auth session when wallet is disconnected
      clearXAuthSession();
      return;
    }

    setLoading(true);
    setError(null);
    setLoaded(false);

    try {
      // Read-only: the profile row is only created when the user registers or
      // starts a paid game session, so wallet visits cannot spam the database.
      const userData = await getUserByWallet(address);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
      console.error('Error refreshing user:', err);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [address, isConnected]);

  const registerUser = async (data: UserRegistrationData): Promise<boolean> => {
    if (!address || !isConnected) {
      setError('No wallet connected');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Sign the canonical profile message so the API can prove this wallet
      // authorized the update.
      const timestamp = Date.now();
      const signature = await signMessageAsync({
        message: buildProfileUpdateMessage({
          walletAddress: address,
          username: data.username,
          timestamp,
        }),
      });

      const updatedUser = await updateUserRegistration(address, data, {
        signature,
        timestamp,
      });

      if (updatedUser) {
        setUser(updatedUser);
        return true;
      }

      setError('Failed to register user');
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      console.error('Error registering user:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Load user when wallet connects/changes
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Check if user needs registration (missing row or not yet registered)
  const needsRegistration = Boolean(isConnected && loaded && (!user || !user.is_registered));

  return {
    user,
    loading,
    error,
    refreshUser,
    registerUser,
    needsRegistration,
  };
};
