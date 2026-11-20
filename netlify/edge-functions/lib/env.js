/**
 * Runtime configuration for the Netlify edge functions.
 *
 * Environment variables win when they are set in Netlify; the published
 * values from `src/config/supabase.js` (the same ones the browser bundle
 * uses) are the fallback, so the edge keeps working with zero setup.
 */

export function readEnv(name) {
  try {
    const netlify = globalThis.Netlify?.env
    if (netlify?.get) {
      const value = netlify.get(name)
      if (value) return value
    }
  } catch {
    // Ignore and fall through to Deno / defaults.
  }
  try {
    const value = globalThis.Deno?.env?.get?.(name)
    if (value) return value
  } catch {
    // Env permission not granted — use defaults.
  }
  return ''
}
