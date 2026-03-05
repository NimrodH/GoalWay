import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const COOKIE_NAME = "sb-session";

// Client-side singleton
let supabaseInstance: SupabaseClient | null = null;

/**
 * Cookie-based storage adapter so the session is readable server-side.
 */
function getCookieStorage() {
  return {
    getItem: (key: string): string | null => {
      if (typeof document === "undefined") return null;
      const match = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(key)}=([^;]*)`));
      return match ? decodeURIComponent(match[1]) : null;
    },
    setItem: (key: string, value: string) => {
      if (typeof document === "undefined") return;
      // 7 day expiry, SameSite=Lax so it works on navigation
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    },
    removeItem: (key: string) => {
      if (typeof document === "undefined") return;
      document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0`;
    },
  };
}

/**
 * Initialise the client-side Supabase singleton. Call once from the root component.
 */
export function initSupabase(url: string, key: string) {
  if (typeof window === "undefined") return;
  if (supabaseInstance) return;

  supabaseInstance = createClient(url, key, {
    auth: {
      storage: getCookieStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Returns the client-side Supabase singleton.
 * Must be called after initSupabase().
 */
export function getSupabase(): SupabaseClient {
  if (typeof window === "undefined") {
    // Server-side — return an unauthenticated client (used for non-auth queries)
    return createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);
  }

  if (!supabaseInstance) {
    throw new Error("Supabase client not initialized. Call initSupabase() first.");
  }
  return supabaseInstance;
}

/**
 * Creates a server-side Supabase client that reads the session from cookies.
 */
export function createServerClient(request: Request): SupabaseClient {
  const cookieHeader = request.headers.get("Cookie") || "";

  // Build a simple cookie-jar map
  const cookieMap: Record<string, string> = {};
  cookieHeader.split(";").forEach((part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey) {
      try {
        cookieMap[decodeURIComponent(rawKey.trim())] = decodeURIComponent(rest.join("=").trim());
      } catch {
        // ignore malformed cookies
      }
    }
  });

  return createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!, {
    auth: {
      storage: {
        getItem: (key: string) => cookieMap[key] ?? null,
        setItem: () => {},
        removeItem: () => {},
      },
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Creates an authenticated server-side client using an explicit access token.
 */
export function getAuthenticatedSupabase(accessToken: string): SupabaseClient {
  const client = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);
  client.auth.setSession({ access_token: accessToken, refresh_token: "" });
  return client;
}
