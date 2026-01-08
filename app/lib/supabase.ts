import { createClient } from '@supabase/supabase-js';

// These will be undefined on the client side initially
// They're passed from the loader to create a client-side instance
let supabaseUrl: string;
let supabaseKey: string;

// This will be set by the loader
let supabaseInstance: ReturnType<typeof createClient> | null = null;

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
    supabaseInstance = createClient(url, key);
  }
}
