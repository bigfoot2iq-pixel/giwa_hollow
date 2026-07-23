'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Edit3, LogOut, ChevronDown, Copy, Wallet } from 'lucide-react';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useMultiUser } from '@/lib/hooks/useMultiUser';
import UserRegistrationModal from './UserRegistrationModal';

export default function MultiWalletConnect() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { user, loading: userLoading, needsRegistration, registerUser } = useMultiUser();

  const [mounted, setMounted] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (needsRegistration) {
      setShowRegistrationModal(true);
    }
  }, [needsRegistration]);

  const handleProfileClick = () => {
    setShowRegistrationModal(true);
    setShowDropdown(false);
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
  };

  const handleCopyAddress = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    }
  };

  const formatAddress = (addr: string | undefined) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!mounted) return null;

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, mounted: rkMounted }) => {
        const ready = rkMounted;
        const connected = ready && account && chain;

        if (!ready) return null;

        // Not connected — show connect button
        if (!connected) {
          return (
            <motion.button
              onClick={openConnectModal}
              className="relative overflow-hidden px-6 py-3 rounded-full bg-primary text-text-primary font-semibold hover:shadow-2xl hover:shadow-primary/25 transition-all duration-300 group border-none"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="relative z-10">Connect Wallet</span>
            </motion.button>
          );
        }

        // Wrong network — show switch button
        if (chain.unsupported) {
          return (
            <motion.button
              onClick={openChainModal}
              className="relative overflow-hidden px-6 py-3 rounded-full bg-red-500 text-text-primary font-semibold hover:bg-red-600 transition-all duration-300 border-none"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="relative z-10">Wrong Network</span>
            </motion.button>
          );
        }

        // Connected — show user dropdown
        return (
          <>
            <div className="relative" ref={dropdownRef}>
              <motion.button
                className={`flex items-center space-x-3 px-4 py-2 bg-dark-navy/80 backdrop-blur-sm border border-primary/20 rounded-full text-text-primary hover:border-primary/40 hover:bg-dark-blue/5 transition-all duration-300 shadow-lg hover:shadow-primary/10 ${
                  showRegistrationModal ? 'cursor-default' : 'cursor-pointer'
                }`}
                whileHover={showRegistrationModal ? {} : { scale: 1.02 }}
                whileTap={showRegistrationModal ? {} : { scale: 0.98 }}
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={showRegistrationModal}
              >
                {/* User Avatar */}
                <div className="relative">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-dark-navy via-primary to-dark-blue p-0.5">
                    <div className="w-full h-full rounded-full overflow-hidden bg-dark-navy flex items-center justify-center">
                      {user?.image_url ? (
                        <img src={user.image_url} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <User size={16} className="text-text-primary" />
                      )}
                    </div>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full"></div>
                </div>

                {/* User Info */}
                <div className="flex flex-col text-left min-w-0 flex-1">
                  <span className="font-semibold text-sm text-text-primary truncate">
                    {user?.username || 'anonymous'}
                  </span>
                  <div className="flex items-center space-x-1">
                    <Wallet size={16} className="text-blue-400" />
                    <span className="text-xs text-text-secondary font-mono">
                      {account.displayName}
                    </span>
                  </div>
                </div>

                <ChevronDown
                  size={16}
                  className={`text-text-secondary transition-all duration-200 flex-shrink-0 ${
                    showDropdown ? 'rotate-180 text-primary' : 'hover:text-text-primary'
                  }`}
                />
              </motion.button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <motion.div
                  className="absolute top-full right-0 mt-3 w-72 bg-dark-navy/95 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  {/* User Info Header */}
                  <div className="px-6 py-4 border-b border-dark-blue/10 bg-gradient-to-r from-dark-blue/5 to-primary/5">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-dark-navy via-primary to-dark-blue p-0.5">
                          <div className="w-full h-full rounded-full overflow-hidden bg-dark-navy flex items-center justify-center">
                            {user?.image_url ? (
                              <img src={user.image_url} alt={user.username} className="w-full h-full object-cover" />
                            ) : (
                              <User size={20} className="text-text-primary" />
                            )}
                          </div>
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-gray-900 rounded-full"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-text-primary text-base truncate">{user?.username || 'anonymous'}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Wallet size={16} className="text-blue-400" />
                          <span className="text-xs text-text-secondary font-mono">
                            {formatAddress(address)}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full font-medium">
                            Connected
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <button
                      onClick={handleProfileClick}
                      className="w-full flex items-center space-x-3 px-6 py-3 text-left text-text-primary hover:text-text-primary hover:bg-gradient-to-r hover:from-dark-blue/10 hover:to-primary/10 transition-all duration-200 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-dark-blue/20 flex items-center justify-center group-hover:bg-dark-blue/30 transition-colors">
                        <Edit3 size={16} className="text-primary" />
                      </div>
                      <span className="text-sm font-medium">Edit Profile</span>
                    </button>

                    <button
                      onClick={handleCopyAddress}
                      className="w-full flex items-center space-x-3 px-6 py-3 text-left text-text-primary hover:text-text-primary hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10 transition-all duration-200 group"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        copySuccess ? 'bg-green-500/20' : 'bg-blue-500/20 group-hover:bg-blue-500/30'
                      }`}>
                        <Copy size={16} className={`${copySuccess ? 'text-green-400' : 'text-blue-400'}`} />
                      </div>
                      <span className="text-sm font-medium">
                        {copySuccess ? 'Address Copied!' : 'Copy Address'}
                      </span>
                    </button>

                    <div className="mx-4 my-2 border-t border-dark-blue/10"></div>

                    <button
                      onClick={handleDisconnect}
                      className="w-full flex items-center space-x-3 px-6 py-3 text-left text-primary hover:text-[#2ee6a6] hover:bg-gradient-to-r hover:from-dark-blue/10 hover:to-dark-navy/10 transition-all duration-200 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-dark-blue/20 flex items-center justify-center group-hover:bg-dark-blue/30 transition-colors">
                        <LogOut size={16} className="text-primary" />
                      </div>
                      <span className="text-sm font-medium">Disconnect</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Registration Modal */}
            <UserRegistrationModal
              isOpen={showRegistrationModal}
              onClose={() => setShowRegistrationModal(false)}
              onSubmit={async (data) => {
                const success = await registerUser(data);
                if (success) {
                  setShowRegistrationModal(false);
                }
                return success;
              }}
              loading={userLoading}
              user={user}
            />
          </>
        );
      }}
    </ConnectButton.Custom>
  );
}
