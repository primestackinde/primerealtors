import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Guards against the regressions this CMS was rebuilt to fix:
 * credentials shipped in the bundle, duplicate/legacy data paths, and the
 * database becoming world-writable again.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

function sourceFiles(dir = SRC) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(js|jsx)$/.test(entry.name) ? [full] : []
  })
}

function read(file) {
  return readFileSync(file, 'utf8')
}

describe('no credentials in the shipped bundle', () => {
  const files = sourceFiles()

  it('never embeds a shared admin password or hash', () => {
    const forbidden = /passwordHash|adminPassword|admin_hash|ADMIN_PASSWORD|sha-?256/i
    const offenders = files.filter((file) => forbidden.test(read(file)))
    expect(offenders.map((file) => relative(ROOT, file))).toEqual([])
  })

  it('authenticates through Supabase Auth instead of client-side checks', () => {
    const service = read(join(SRC, 'data', 'blogService.js'))
    expect(service).toContain('supabase.auth')
    expect(service).toContain('signInWithPassword')
    expect(service).toContain('signOut')
  })
})

describe('single data path', () => {
  it('has no legacy localStorage blog module', () => {
    expect(existsSync(join(SRC, 'data', 'blogs.js'))).toBe(false)
  })

  it('never treats localStorage as a source of articles', () => {
    const offenders = sourceFiles().filter((file) => /localStorage/.test(read(file)))
    expect(offenders.map((file) => relative(ROOT, file))).toEqual([])
  })

  it('keeps Supabase connection values in one shared module', () => {
    const allowed = [join('src', 'config', 'supabase.js'), join('src', 'data', 'supabaseClient.js')]
    const offenders = sourceFiles().filter((file) => {
      const rel = relative(ROOT, file)
      return !allowed.includes(rel) && /sb_publishable_|supabase\.co\/rest/.test(read(file))
    })
    expect(offenders.map((file) => relative(ROOT, file))).toEqual([])
  })
})

describe('database security migrations ship with the code', () => {
  const migration = join(ROOT, 'supabase', 'migrations', '0001_blog_cms.sql')

  it('exists and enables Row Level Security', () => {
    expect(existsSync(migration)).toBe(true)
    const sql = read(migration)
    expect(/enable row level security/i.test(sql)).toBe(true)
    // Public reads are limited to published rows …
    expect(
      /create policy "Published articles are public"[\s\S]*?to\s+anon,\s*authenticated[\s\S]*?using\s*\(\s*status\s*=\s*'published'\s*\)/i.test(sql),
    ).toBe(true)
    // … and every write requires a signed-in editor.
    expect(
      /create policy "Signed-in editors manage articles"[\s\S]*?for\s+all[\s\S]*?to\s+authenticated/i.test(sql),
    ).toBe(true)
    // The anon key ships in the bundle: it may appear on the SELECT policy
    // only — never on a policy that can insert, update, delete or do "all".
    const policies = sql.split(/create policy/i).slice(1)
    expect(policies.length).toBeGreaterThanOrEqual(2)
    const anonPolicies = policies.filter((policy) => /to\s+anon\b/i.test(policy))
    expect(anonPolicies.length).toBeGreaterThan(0)
    for (const policy of anonPolicies) {
      expect(/for\s+(insert|update|delete|all)\b/i.test(policy)).toBe(false)
    }
  })

  it('ships the storage bucket migration for article images', () => {
    const storage = join(ROOT, 'supabase', 'migrations', '0002_blog_storage.sql')
    expect(existsSync(storage)).toBe(true)
    expect(read(storage)).toContain('blog-images')
  })
})

describe('edge SEO wiring', () => {
  it('registers the edge function in netlify.toml', () => {
    const toml = read(join(ROOT, 'netlify.toml'))
    expect(toml).toContain('[[edge_functions]]')
    expect(toml).toContain('function = "site"')
    expect(toml).toContain('path = "/*"')
    expect(existsSync(join(ROOT, 'netlify', 'edge-functions', 'site.js'))).toBe(true)
  })

  it('keeps the public fallback sitemap in place', () => {
    expect(statSync(join(ROOT, 'public', 'sitemap.xml')).size).toBeGreaterThan(0)
  })
})
