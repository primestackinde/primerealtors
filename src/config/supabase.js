/**
 * Public Supabase connection values, in one place.
 *
 * These are *publishable* credentials (safe to ship in the browser bundle by
 * design — Row Level Security, not the key, protects the data). They are
 * re-exported here so the browser client and the Netlify edge functions read
 * the exact same values. Environment variables `SUPABASE_URL` and
 * `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`) override them at the
 * edge when set in Netlify.
 */
export const SUPABASE_URL = 'https://wzwmjgttodgnwjuuuavn.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_djdSrcJNkBFeD-hFyPO3WQ_K6XUmaGq'
