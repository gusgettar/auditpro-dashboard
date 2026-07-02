import path from 'path'
import fs from 'fs'

interface CacheEntry { value: any; expires: number }
const CACHE: Record<string, CacheEntry> = {}
const TTL_MS = 5 * 60 * 1000

async function fetchFromBlob(name: string): Promise<any> {
  const base = process.env.BLOB_BASE_URL
  if (!base) return null
  try {
    const res = await fetch(`${base}/${name}.json`)
    if (res.ok) return res.json()
  } catch {}
  return null
}

function readFromDisk(name: string): any {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', `${name}.json`), 'utf-8'))
  } catch { return null }
}

export async function getData(name: string): Promise<any> {
  const uptime = process.uptime() * 1000  // ms since process started

  if (CACHE[name] && CACHE[name].expires > uptime) return CACHE[name].value

  let value = await fetchFromBlob(name)
  if (!value) value = readFromDisk(name)

  if (value != null) {
    CACHE[name] = { value, expires: uptime + TTL_MS }
  }
  return value ?? {}
}

export function clearCache(name?: string) {
  if (name) delete CACHE[name]
  else Object.keys(CACHE).forEach(k => delete CACHE[k])
}
