import { TheAriwaUser, UserRegistrationData } from '@/lib/supabase/types';

/**
 * Client-side profile helpers.
 *
 * All reads/writes go through /api/game-user, which holds the service-role key
 * server-side and verifies a wallet signature for updates. The browser never
 * touches Supabase directly for profile data.
 */

const AVATAR_MAX_SIZE = 200;
const AVATAR_QUALITY = 0.8;

/**
 * Compress an image file to a smaller size suitable for profile avatars
 * Target: 200x200px max, JPEG format with 0.8 quality
 */
const compressImage = async (file: File, maxSize: number = 200, quality: number = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          // Create new file from blob
          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Get user by wallet address. Returns null when the wallet has no profile yet.
 */
export const getUserByWallet = async (walletAddress: string): Promise<TheAriwaUser | null> => {
  try {
    const response = await fetch(
      `/api/game-user?wallet=${encodeURIComponent(walletAddress)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      console.error('Error fetching user:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return (data.user as TheAriwaUser) ?? null;
  } catch (err) {
    console.error('Error in getUserByWallet:', err);
    return null;
  }
};

export interface ProfileAuth {
  signature: string;
  timestamp: number;
}

/**
 * Create or update the profile. The caller must sign the canonical profile
 * message (`buildProfileUpdateMessage`) first; the API verifies it before
 * writing, so only the wallet owner can change the row.
 */
export const updateUserRegistration = async (
  walletAddress: string,
  registrationData: UserRegistrationData,
  auth: ProfileAuth
): Promise<TheAriwaUser | null> => {
  try {
    const formData = new FormData();
    formData.append('wallet', walletAddress);
    formData.append('username', registrationData.username);
    formData.append('timestamp', String(auth.timestamp));
    formData.append('signature', auth.signature);

    if (registrationData.removeImage) {
      formData.append('removeImage', 'true');
    }

    if (registrationData.imageFile) {
      const compressedFile = await compressImage(
        registrationData.imageFile,
        AVATAR_MAX_SIZE,
        AVATAR_QUALITY
      );
      formData.append('image', compressedFile, compressedFile.name);
    }

    const response = await fetch('/api/game-user', {
      method: 'PATCH',
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      console.error('Error updating user registration:', body?.error || response.statusText);
      return null;
    }

    const data = await response.json();
    return (data.user as TheAriwaUser) ?? null;
  } catch (err) {
    console.error('Error in updateUserRegistration:', err);
    return null;
  }
};
