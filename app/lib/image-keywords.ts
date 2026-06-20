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

export interface ImageCategories {
  keywords: string[];
  software: string | null;
  module: string | null;
  screen: string | null;
  item: string | null;
}

/**
 * Fetch keywords for multiple image paths in one query.
 * Returns a map: image_path => ImageCategories
 */
export async function fetchCategoriesForPaths(
  imagePaths: string[]
): Promise<Record<string, ImageCategories>> {
  if (imagePaths.length === 0) return {};
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('image_keywords')
      .select('image_path, keywords, software, module, screen, item')
      .in('image_path', imagePaths);

    if (error || !data) return {};
    return data.reduce<Record<string, ImageCategories>>((acc, row) => {
      acc[row.image_path] = {
        keywords: row.keywords ?? [],
        software: row.software ?? null,
        module: row.module ?? null,
        screen: row.screen ?? null,
        item: row.item ?? null,
      };
      return acc;
    }, {});
  } catch {
    return {};
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
