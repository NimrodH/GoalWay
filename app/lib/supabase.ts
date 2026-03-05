import { createClient } from "@supabase/supabase-js";
import { createBrowserClient, createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Client-side ───────────────────────────────────────────────────────────

/**
 * Returns a browser-side Supabase client using @supabase/ssr.
 * createBrowserClient already uses a singleton internally.
 */
export function getSupabase(): SupabaseClient {
  if (typeof window === "undefined") {
    // Server-side fallback — unauthenticated (used for non-auth queries)
    return createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);
  }
  return createBrowserClient(
    window.__supabaseUrl ?? process.env.SUPABASE_PROJECT_URL!,
    window.__supabaseKey ?? process.env.SUPABASE_API_KEY!
  );
}

/**
 * Initialise the browser Supabase client with the project's credentials.
 * Must be called once from root.tsx before any client-side auth calls.
 */
export function initSupabase(url: string, key: string) {
  if (typeof window === "undefined") return;
  window.__supabaseUrl = url;
  window.__supabaseKey = key;
}

// Augment the global Window type so TypeScript is happy
declare global {
  interface Window {
    __supabaseUrl?: string;
    __supabaseKey?: string;
  }
}

// ─── Server-side ───────────────────────────────────────────────────────────

/**
 * Creates a server-side Supabase client that reads cookies from the request
 * and can write cookies to the response via the returned headers object.
 *
 * Usage in a loader/action:
 *   const { supabase, headers } = createServerSupabase(request);
 *   // ... use supabase ...
 *   return json(data, { headers });
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
