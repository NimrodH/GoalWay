import { createClient } from "@supabase/supabase-js";
import { createBrowserClient, createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Client-side ───────────────────────────────────────────────────────────

/** Module-level singleton so we never create a broken client with undefined creds. */
let _browserClient: SupabaseClient | null = null;
let _initializedUrl = "";
let _initializedKey = "";

/**
 * Initialise the browser Supabase client with the project's credentials.
 * Must be called synchronously (not inside useEffect) before any auth calls.
 * Safe to call multiple times — only re-creates the client when credentials change.
 */
export function initSupabase(url: string, key: string) {
  if (typeof window === "undefined") return;
  if (!url || !key) return;

  // Re-create only if credentials actually changed (e.g., hot-reload in dev).
  if (_browserClient && url === _initializedUrl && key === _initializedKey) return;

  _browserClient = createBrowserClient(url, key);
  _initializedUrl = url;
  _initializedKey = key;
}

/**
 * Returns the browser-side Supabase client.
 * Throws a clear error if initSupabase() was not called yet.
 */
export function getSupabase(): SupabaseClient {
  if (typeof window === "undefined") {
    // Server-side fallback — unauthenticated (used for non-auth queries)
    return createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);
  }

  if (!_browserClient) {
    // Credentials not yet available — return a temporary client so callers
    // don't crash.  initSupabase() must be called synchronously during render
    // (before any useAuth hook fires) to avoid this path.
    const url = process.env.SUPABASE_PROJECT_URL ?? "";
    const key = process.env.SUPABASE_API_KEY ?? "";
    if (url && key) {
      _browserClient = createBrowserClient(url, key);
      _initializedUrl = url;
      _initializedKey = key;
    } else {
      // No credentials at all — nothing we can do yet.
      throw new Error("Supabase not initialized. Call initSupabase(url, key) before getSupabase().");
    }
  }

  return _browserClient;
}

// ─── Server-side ───────────────────────────────────────────────────────────

/**
 * Creates a server-side Supabase client that reads cookies from the request
 * and can write cookies to the response via the returned headers object.
 */
export function createServerSupabase(request: Request) {
  const headers = new Headers();

  const supabase = createServerClient(
    process.env.SUPABASE_PROJECT_URL!,
    process.env.SUPABASE_API_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "").map((c) => ({
            name: c.name,
            value: c.value ?? "",
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            headers.append("Set-Cookie", serializeCookieHeader(name, value, options));
          });
        },
      },
    }
  );

  return { supabase, headers };
}

/**
 * @deprecated Use createServerSupabase instead.
 * Kept for backwards compatibility with auth.server.ts.
 */
export function createServerClient_compat(request: Request): SupabaseClient {
  return createServerSupabase(request).supabase;
}

/**
 * Creates an authenticated server-side client using an explicit access token.
 * Used for admin operations that require the user's JWT.
 */
export function getAuthenticatedSupabase(accessToken: string): SupabaseClient {
  const client = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);
  client.auth.setSession({ access_token: accessToken, refresh_token: "" });
  return client;
}

// Augment the global Window type so TypeScript is happy
declare global {
  interface Window {
    __supabaseUrl?: string;
    __supabaseKey?: string;
  }
}
