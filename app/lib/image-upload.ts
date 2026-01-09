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

export async function listImages(folder?: string): Promise<{ images: Array<{ name: string; url: string; path: string }>; error?: string }> {
  try {
    const supabase = getSupabase();
    
    // List all files in the bucket
    const { data, error } = await supabase.storage
      .from('mission-images')
      .list(folder, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      return { images: [], error: error.message };
    }

    // Get public URLs for all files (files have an id, folders have id=null)
    const images = data
      .filter(file => file.id !== null) // Filter out folders
      .map(file => {
        const path = folder ? `${folder}/${file.name}` : file.name;
        const { data: { publicUrl } } = supabase.storage
          .from('mission-images')
          .getPublicUrl(path);
        
        return {
          name: file.name,
          url: publicUrl,
          path: path
        };
      });

    return { images };
  } catch (error) {
    return { 
      images: [], 
      error: error instanceof Error ? error.message : 'Failed to list images' 
    };
  }
}

export async function listAllImages(): Promise<{ images: Array<{ name: string; url: string; path: string }>; error?: string }> {
  try {
    const supabase = getSupabase();
    
    // First list all folders
    const { data: folders, error: foldersError } = await supabase.storage
      .from('mission-images')
      .list('', {
        limit: 100,
        offset: 0
      });

    if (foldersError) {
      return { images: [], error: foldersError.message };
    }

    const allImages: Array<{ name: string; url: string; path: string }> = [];

    // Get images from root
    const rootResult = await listImages();
    if (rootResult.images) {
      allImages.push(...rootResult.images);
    }

    // Get images from each folder (folders have id=null)
    for (const folder of folders) {
      if (folder.id === null) { // It's a folder
        const folderResult = await listImages(folder.name);
        if (folderResult.images) {
          allImages.push(...folderResult.images);
        }
      }
    }

    return { images: allImages };
  } catch (error) {
    return { 
      images: [], 
      error: error instanceof Error ? error.message : 'Failed to list images' 
    };
  }
}
