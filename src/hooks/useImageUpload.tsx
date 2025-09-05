
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    setUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('user-photos')
        .upload(fileName, file);

      if (error) {
        console.error('Error uploading image:', error);
        return null;
      }

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('user-photos')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (url: string): Promise<boolean> => {
    if (!user) {
      console.error('User not authenticated');
      return false;
    }

    try {
      // Extract the path from the URL
      const urlParts = url.split('/');
      const path = urlParts.slice(-2).join('/'); // Get user_id/filename.ext

      const { error } = await supabase.storage
        .from('user-photos')
        .remove([path]);

      if (error) {
        console.error('Error deleting image:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  };

  return {
    uploadImage,
    deleteImage,
    uploading
  };
};
