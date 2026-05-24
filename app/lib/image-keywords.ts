import { getSupabase } from './supabase';

/**
 * Fetch keywords for a single image path from the browser.
 */
export async function fetchImageKeywords(
  imagePath: string
): Promise<string[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('image_keywords')
      .select('keywords')
      .eq('image_path', imagePath)
      .maybeSingle();

    if (error || !data) return [];
    return data.keywords ?? [];
  } catch {
    return [];
  }
}

/**
 * Upsert keywords for a single image path from the browser.
 */
export async function saveImageKeywords(
  imagePath: string,
  keywords: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('image_keywords')
      .upsert(
        { image_path: imagePath, keywords, updated_at: new Date().toISOString() },
        { onConflict: 'image_path' }
      );

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save keywords' };
  }
}

/**
 * Fetch keywords for multiple image paths in one query.
 * Returns a map: image_path => keywords[]
 */
export async function fetchKeywordsForPaths(
  imagePaths: string[]
): Promise<Record<string, string[]>> {
  if (imagePaths.length === 0) return {};
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('image_keywords')
      .select('image_path, keywords')
      .in('image_path', imagePaths);

    if (error || !data) return {};
    return data.reduce<Record<string, string[]>>((acc, row) => {
      acc[row.image_path] = row.keywords ?? [];
      return acc;
    }, {});
  } catch {
    return {};
  }
}
