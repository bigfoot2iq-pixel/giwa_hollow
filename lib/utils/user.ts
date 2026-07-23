import supabase from '@/lib/supabase/game-client';
import { TheHollowUser, UserRegistrationData, WalletType } from '@/lib/supabase/types';

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
 * Get user by wallet address and type
 */
export const getUserByWallet = async (walletAddress: string, walletType?: WalletType): Promise<TheHollowUser | null> => {
  try {
    let query = supabase
      .from('litvm_raffle_game_users')
      .select('*')
      .eq('wallet_address', walletAddress);
    
    // If wallet type is provided, filter by it as well
    if (walletType) {
      query = query.eq('wallet_type', walletType);
    }
    
    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching user:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error in getUserByWallet:', err);
    return null;
  }
};

/**
 * Create or update user on wallet connection
 */
export const upsertUser = async (walletAddress: string, walletType: WalletType): Promise<TheHollowUser | null> => {
  try {
    const { data, error } = await supabase
      .rpc('upsert_litvm_raffle_game_user', { 
        wallet: walletAddress, 
        wallet_type: walletType 
      });

    if (error) {
      console.error('Error upserting user:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error in upsertUser:', err);
    return null;
  }
};

/**
 * Update user profile information (works for both registration and profile editing)
 */
export const updateUserRegistration = async (
  walletAddress: string,
  registrationData: UserRegistrationData,
  walletType?: WalletType
): Promise<TheHollowUser | null> => {
  try {
    console.log('updateUserRegistration called with:', { walletAddress, registrationData });
    
    // Get current user data to handle image updates properly
    const currentUser = await getUserByWallet(walletAddress, walletType);
    if (!currentUser) {
      throw new Error('User not found');
    }
    
    console.log('Current user:', currentUser);

    let imageUrl: string | null = currentUser.image_url || null; // Keep existing image by default

    // Handle image changes
    if (registrationData.imageFile) {
      // Delete old avatar if it exists
      if (currentUser.image_url) {
        await deleteOldAvatar(currentUser.image_url);
      }
      
      // Upload new avatar
      imageUrl = await uploadAvatar(walletAddress, registrationData.imageFile);
      if (!imageUrl) {
        throw new Error('Failed to upload avatar');
      }
    } else if (registrationData.removeImage) {
      // User wants to remove their current image
      if (currentUser.image_url) {
        await deleteOldAvatar(currentUser.image_url);
      }
      imageUrl = null;
    }

    // Prepare update data
    const updateData: any = {
      username: registrationData.username,
      is_registered: true,
    };

    // Update image_url if we have changes (new image or removal)
    if (registrationData.imageFile || registrationData.removeImage) {
      updateData.image_url = imageUrl;
    }

    console.log('Updating user with data:', updateData);
    
    // Update user record
    const { data, error } = await supabase
      .from('litvm_raffle_game_users')
      .update(updateData)
      .eq('wallet_address', walletAddress)
      .select()
      .single();

    if (error) {
      console.error('Error updating user registration:', error);
      return null;
    }

    console.log('User updated successfully:', data);
    return data;
  } catch (err) {
    console.error('Error in updateUserRegistration:', err);
    return null;
  }
};

/**
 * Upload user avatar to Supabase storage
 * Images are compressed to 200x200px max before upload for performance
 */
export const uploadAvatar = async (walletAddress: string, file: File): Promise<string | null> => {
  try {
    // Validate file size (max 2MB for original)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('File size must be less than 2MB');
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Compress image before upload (200x200px max, JPEG 80% quality)
    const compressedFile = await compressImage(file, 200, 0.8);
    console.log(`Image compressed: ${file.size} bytes -> ${compressedFile.size} bytes`);

    // Generate unique filename (always .jpg after compression)
    const fileName = `${walletAddress}_${Date.now()}.jpg`;

    // Upload compressed file
    const { data, error } = await supabase.storage
      .from('litvm-raffle-avatars')
      .upload(fileName, compressedFile, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Error uploading file:', error);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('litvm-raffle-avatars')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Error in uploadAvatar:', err);
    return null;
  }
};

/**
 * Delete old avatar when uploading new one
 */
export const deleteOldAvatar = async (imageUrl: string): Promise<void> => {
  try {
    if (!imageUrl) return;

    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    await supabase.storage
      .from('litvm-raffle-avatars')
      .remove([fileName]);
  } catch (err) {
    console.error('Error deleting old avatar:', err);
  }
}; 