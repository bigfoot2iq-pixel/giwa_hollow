'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { TheHollowUser, UserRegistrationData } from '@/lib/supabase/types';
import { getUserByWallet, upsertUser, updateUserRegistration } from '@/lib/utils/user';
import { clearXAuthSession } from '@/lib/utils/x-auth';

interface UseMultiUserReturn {
  user: TheHollowUser | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  registerUser: (data: UserRegistrationData) => Promise<boolean>;
  needsRegistration: boolean;
}

export const useMultiUser = (): UseMultiUserReturn => {
  const { address, isConnected } = useAccount();
  const [user, setUser] = useState<TheHollowUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    if (!address || !isConnected) {
      setUser(null);
      setError(null);
      // Clear X auth session when wallet is disconnected
      clearXAuthSession();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First try to get existing user
      let userData = await getUserByWallet(address, 'evm');
      
      // If user doesn't exist, create them
      if (!userData) {
        userData = await upsertUser(address, 'evm');
      }

      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
      console.error('Error refreshing user:', err);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected]);

  const registerUser = async (data: UserRegistrationData): Promise<boolean> => {
    if (!address || !user) {
      setError('No wallet connected');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const updatedUser = await updateUserRegistration(address, data, 'evm');
      
      if (updatedUser) {
        setUser(updatedUser);
        return true;
      } else {
        setError('Failed to register user');
        return false;
      }
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

  // Check if user needs registration
  const needsRegistration = Boolean(isConnected && user && !user.is_registered);

  return {
    user,
    loading,
    error,
    refreshUser,
    registerUser,
    needsRegistration,
  };
}; 