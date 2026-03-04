import { createServerClient } from "~/lib/supabase";

export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  organization_id: string | null;
  role: "user" | "admin";
  organizations: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

/**
 * Reads the session from the request cookie and returns the user's profile.
 * Returns null if the user is not authenticated.
 */
export async function getUserProfile(request: Request): Promise<UserProfile | null> {
  const supabase = createServerClient(request);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", session.user.id)
    .single();

  if (!profile) return null;

  return profile as UserProfile;
}

/**
 * Returns true if the user is an admin.
 */
export function isAdmin(profile: UserProfile | null): boolean {
  return profile?.role === "admin";
}
