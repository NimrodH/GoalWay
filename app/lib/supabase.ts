import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// These will be undefined on the client side initially
// They're passed from the loader to create a client-side instance
let supabaseUrl: string;
let supabaseKey: string;

// This will be set by the loader
let supabaseInstance: SupabaseClient | null = null;

export function getSupabase() {
  if (typeof window === 'undefined') {
    // Server-side: create new instance each time
    return createClient(
      process.env.SUPABASE_PROJECT_URL!,
      process.env.SUPABASE_API_KEY!
    );
  }
  
  // Client-side: reuse instance
  if (!supabaseInstance) {
    throw new Error('Supabase client not initialized. Call initSupabase() first.');
  }
  return supabaseInstance;
}

export function initSupabase(url: string, key: string) {
  if (typeof window !== 'undefined' && !supabaseInstance) {
    supabaseUrl = url;
    supabaseKey = key;
    supabaseInstance = createClient(url, key, {
      auth: {
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
}

// Helper to create server-side client with request context
export function createServerClient(request: Request) {
  const cookies = request.headers.get('Cookie') || '';
  
  return createClient(
    process.env.SUPABASE_PROJECT_URL!,
    process.env.SUPABASE_API_KEY!,
    {
      auth: {
        storage: {
          getItem: (key: string) => {
            // Parse session from cookies
            const match = cookies.match(new RegExp(`(^| )${key}=([^;]+)`));
            return match ? match[2] : null;
          },
          setItem: () => {},
          removeItem: () => {},
        },
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
}
