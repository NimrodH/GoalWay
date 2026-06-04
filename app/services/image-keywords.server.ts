import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);
}

/**
 * Fetch keywords for a list of image paths in one query.
 * Returns a map: image_path => keywords[]
 */
export async function getKeywordsForPaths(
  imagePaths: string[]
): Promise<Record<string, string[]>> {
  if (imagePaths.length === 0) return {};
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("image_keywords")
    .select("image_path, keywords")
    .in("image_path", imagePaths);

  if (error || !data) return {};

  return data.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.image_path] = row.keywords ?? [];
    return acc;
  }, {});
}

/**
 * Upsert keywords for a single image path (server-side).
 */
export async function upsertImageKeywords(
  imagePath: string,
  keywords: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("image_keywords")
    .upsert(
      { image_path: imagePath, keywords, updated_at: new Date().toISOString() },
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
    .select("keywords")
    .eq("image_path", oldPath)
    .maybeSingle();

  if (!data) return { success: true }; // Nothing to rename

  const { error: upsertError } = await supabase
    .from("image_keywords")
    .upsert(
      { image_path: newPath, keywords: data.keywords, updated_at: new Date().toISOString() },
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
