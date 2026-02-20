import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client with service role key.
 * ONLY use this in API routes and server actions — NEVER in client components.
 * This bypasses RLS, so always verify the caller is authorized first.
 * Client is created lazily so the app can build when env vars are not set (e.g. CI/Vercel build).
 */

let _adminClient: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
    if (_adminClient) return _adminClient;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
    }
    if (!supabaseServiceKey) {
        console.error('CRITICAL: Missing SUPABASE_SERVICE_ROLE_KEY — admin operations will fail');
    }
    _adminClient = createClient(supabaseUrl, supabaseServiceKey || '', {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    return _adminClient;
}

/** Lazy-initialized so build succeeds without env vars; throws at runtime if missing. */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
    get(_, prop) {
        return (getSupabaseAdmin() as unknown as Record<string | symbol, unknown>)[prop];
    },
});
