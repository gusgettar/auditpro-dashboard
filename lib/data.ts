import path from 'path'
import fs from 'fs'

interface CacheEntry { value: any; expires: number }
const CACHE: Record<string, CacheEntry> = {}
const TTL_MS = 5 * 60 * 1000

async function fetchFromBlob(name: string): Promise<any> {
  const base = process.env.BLOB_BASE_URL
  if (!base) return null
  try {
    const res = await fetch(`${base}/${name}.json`, { cache: 'no-store' })
    if (res.ok) return res.json()
    console.warn(`[getData] Blob fetch for "${name}" returned ${res.status}`)
  } catch (err) {
    console.error(`[getData] Blob fetch for "${name}" failed:`, err)
  }
  return null
}

function readFromDisk(name: string): any {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', `${name}.json`), 'utf-8'))
  } catch (err) {
    console.error(`[getData] Disk read for "${name}" failed:`, err)
    return null
  }
}

export async function getData(name: string): Promise<any> {
  const uptime = process.uptime() * 1000  // ms since process started

  if (CACHE[name] && CACHE[name].expires > uptime) return CACHE[name].value

  let value = await fetchFromBlob(name)
  if (!value) value = readFromDisk(name)
  if (value == null) console.warn(`[getData] No source found for "${name}" (checked Blob and disk) — returning {}`)

  if (value != null) {
    CACHE[name] = { value, expires: uptime + TTL_MS }
  }
  return value ?? {}
}

export function clearCache(name?: string) {
  if (name) delete CACHE[name]
  else Object.keys(CACHE).forEach(k => delete CACHE[k])
}
