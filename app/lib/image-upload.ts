import { getSupabase } from './supabase';

export async function uploadImage(file: File, folder: string = 'general'): Promise<{ url: string; path: string } | { error: string }> {
  try {
    const supabase = getSupabase();
    
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from('mission-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      return { error: error.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('mission-images')
      .getPublicUrl(fileName);

    return {
      url: publicUrl,
      path: fileName
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Upload failed' };
  }
}

export async function deleteImage(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase.storage
      .from('mission-images')
      .remove([path]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Delete failed' 
    };
  }
}
