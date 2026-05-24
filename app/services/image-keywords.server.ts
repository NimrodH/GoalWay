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
