import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);
}

export interface ImageCategories {
  keywords: string[];
  software: string | null;
  module: string | null;
  screen: string | null;
  item: string | null;
}

/**
 * Fetch keywords and categories for a list of image paths in one query.
 * Returns a map: image_path => ImageCategories
 */
export async function getKeywordsForPaths(
  imagePaths: string[]
): Promise<Record<string, ImageCategories>> {
  if (imagePaths.length === 0) return {};
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("image_keywords")
    .select("image_path, keywords, software, module, screen, item")
    .in("image_path", imagePaths);

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
}

/**
 * Get all unique values for each category field
 */
export async function getAllCategoryValues(): Promise<{
  software: string[];
  module: string[];
  screen: string[];
  item: string[];
}> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("image_keywords")
    .select("software, module, screen, item");

  if (error || !data) {
    return { software: [], module: [], screen: [], item: [] };
  }

  const software = Array.from(new Set(data.map((r) => r.software).filter(Boolean))) as string[];
  const module = Array.from(new Set(data.map((r) => r.module).filter(Boolean))) as string[];
  const screen = Array.from(new Set(data.map((r) => r.screen).filter(Boolean))) as string[];
  const item = Array.from(new Set(data.map((r) => r.item).filter(Boolean))) as string[];

  return { software, module, screen, item };
}

/**
 * Upsert keywords and categories for a single image path (server-side).
 */
export async function upsertImageKeywords(
  imagePath: string,
  categories: ImageCategories
): Promise<{ success: boolean; error?: string }> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("image_keywords")
    .upsert(
      { 
        image_path: imagePath, 
        ...categories,
        updated_at: new Date().toISOString() 
      },
      { onConflict: "image_path" }
    );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Rename an image_keywords entry from oldPath to newPath.
 * Copies keywords to the new path and deletes the old entry.
 * No-op if no entry exists for oldPath.
 */
export async function renameImageKeywords(
  oldPath: string,
  newPath: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getAdminClient();

  const { data } = await supabase
    .from("image_keywords")
    .select("keywords, software, module, screen, item")
    .eq("image_path", oldPath)
    .maybeSingle();

  if (!data) return { success: true }; // Nothing to rename

  const { error: upsertError } = await supabase
    .from("image_keywords")
    .upsert(
      { 
        image_path: newPath, 
        keywords: data.keywords,
        software: data.software,
        module: data.module,
        screen: data.screen,
        item: data.item,
        updated_at: new Date().toISOString() 
      },
      { onConflict: "image_path" }
    );

  if (upsertError) return { success: false, error: upsertError.message };

  const { error: deleteError } = await supabase
    .from("image_keywords")
    .delete()
    .eq("image_path", oldPath);

  if (deleteError) return { success: false, error: deleteError.message };

  return { success: true };
}
