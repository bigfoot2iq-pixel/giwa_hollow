'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { UserRegistrationData, TheHollowUser } from '@/lib/supabase/types';

interface UserRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserRegistrationData) => Promise<boolean>;
  loading: boolean;
  user?: TheHollowUser | null;
}

export default function UserRegistrationModal({
  isOpen,
  onClose,
  onSubmit,
  loading,
  user,
}: UserRegistrationModalProps) {
  const [username, setUsername] = useState(user?.username || 'anonymous');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(user?.image_url || null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update form when user prop changes
  useEffect(() => {
    if (user) {
      setUsername(user.username || 'anonymous');
      setImagePreview(user.image_url || null);
    } else {
      setUsername('anonymous');
      setImagePreview(null);
    }
    setImageFile(null);
    setError(null);
  }, [user, isOpen]);

  const handleFileSelect = (file: File) => {
    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setError('File size must be less than 2MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setError(null);
    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    console.log('Modal handleSubmit called with:', { username, imageFile, user });

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    const submissionData = {
      username: username.trim(),
      imageFile: imageFile || undefined,
    };
    
    console.log('Calling onSubmit with:', submissionData);
    const success = await onSubmit(submissionData);
    console.log('onSubmit result:', success);

    if (success) {
      // Reset form
      setUsername('anonymous');
      setImageFile(null);
      setImagePreview(null);
      onClose();
    }
  };

  const handleSkip = () => {
    // Submit with just username, no image
    onSubmit({
      username: 'anonymous',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-md bg-dark-navy border border-dark-blue/30 rounded-2xl p-6 shadow-2xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary transition-colors rounded-full hover:bg-dark-blue/10"
          >
            <X size={20} />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <motion.div
              className="w-16 h-16 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
            >
              <User size={32} className="text-text-primary" />
            </motion.div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              {user?.is_registered ? 'Edit Profile' : 'Welcome to The Hollow'}
            </h2>
            <p className="text-text-secondary">
              {user?.is_registered ? 'Update your profile information' : 'Complete your profile to get started'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Input */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-dark-navy border border-dark-blue/30 rounded-full text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                placeholder="Enter your username"
                disabled={loading}
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Profile Picture (Optional)
              </label>
              
              <div
                className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                  dragOver
                    ? 'border-primary bg-dark-blue/5'
                    : 'border-dark-blue/30 hover:border-primary/50'
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
              >
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-24 h-24 rounded-full mx-auto object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="absolute -top-2 -right-2 p-1 bg-dark-blue text-text-primary rounded-full hover:bg-dark-navy transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload size={32} className="mx-auto text-text-secondary mb-2" />
                    <p className="text-text-secondary mb-2">
                      Drop an image here or{' '}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-primary hover:text-primary underline"
                      >
                        browse
                      </button>
                    </p>
                    <p className="text-xs text-text-tertiary">
                      Max 2MB • JPG, PNG, GIF
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                className="flex items-center space-x-2 text-primary bg-dark-blue/10 border border-primary/20 rounded-full px-4 py-2"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {!user?.is_registered && (
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-dark-blue/20 hover:bg-dark-blue/30 text-text-primary rounded-full transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Skip
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-3 bg-primary hover:bg-dark-blue text-text-primary rounded-full transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 ${
                  user?.is_registered ? 'w-full' : 'flex-1'
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-text-primary rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle size={18} />
                    <span>{user?.is_registered ? 'Update Profile' : 'Save Profile'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 