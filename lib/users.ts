import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { put, list, get } from '@vercel/blob'

export interface User {
  id: string
  username: string
  name: string
  password: string
  role: 'admin' | 'viewer'
  createdAt: string
}

const BLOB_PATHNAME = 'auditpro-users.json'
const LOCAL_PATH = path.join(process.cwd(), 'data', 'users.json')

function getToken(): string {
  const tok =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN
  if (!tok) throw new Error('No Vercel Blob token found')
  return tok
}

function blobAvailable(): boolean {
  return !!(
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN
  )
}

// ── Read ──────────────────────────────────────────────────────────────────────
export async function readUsers(): Promise<User[]> {
  if (blobAvailable()) {
    try {
      const token = getToken()
      const { blobs } = await list({ prefix: BLOB_PATHNAME, token })
      const blob = blobs.find(b => b.pathname === BLOB_PATHNAME)

      if (blob) {
        // v2.x: use get() for authenticated reads of private blobs
        const res = await get(blob.url, { token, access: 'private' })
        if (res) {
          const text = await new Response(res.stream).text()
          return JSON.parse(text)
        }
      }
    } catch (e) {
      console.error('[users] Blob read error:', e)
    }

    // Not in Blob yet — seed from bundled file
    const local = readLocal()
    if (local.length > 0) {
      try { await writeUsers(local) } catch (e) { console.error('[users] Blob seed error:', e) }
    }
    return local
  }

  return readLocal()
}

function readLocal(): User[] {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf-8'))
  } catch {
    return []
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────
export async function writeUsers(users: User[]): Promise<void> {
  if (blobAvailable()) {
    await put(BLOB_PATHNAME, JSON.stringify(users, null, 2), {
      access: 'private',
      addRandomSuffix: false,
      token: getToken(),
    })
  } else {
    fs.writeFileSync(LOCAL_PATH, JSON.stringify(users, null, 2))
  }
}

// ── Lookups ───────────────────────────────────────────────────────────────────
export async function findByUsername(username: string): Promise<User | undefined> {
  const users = await readUsers()
  return users.find(u => u.username.toLowerCase() === username.toLowerCase())
}

export async function findById(id: string): Promise<User | undefined> {
  const users = await readUsers()
  return users.find(u => u.id === id)
}

// ── Mutations ─────────────────────────────────────────────────────────────────
export async function createUser(
  username: string, name: string, password: string,
  role: 'admin' | 'viewer' = 'viewer'
): Promise<User> {
  const users = await readUsers()
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('El usuario ya existe')
  }
  const hash = await bcrypt.hash(password, 10)
  const newUser: User = {
    id: String(Date.now()), username, name, password: hash, role,
    createdAt: new Date().toISOString(),
  }
  await writeUsers([...users, newUser])
  return newUser
}

export async function updatePassword(id: string, newPassword: string): Promise<void> {
  const users = await readUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx === -1) throw new Error('Usuario no encontrado')
  users[idx].password = await bcrypt.hash(newPassword, 10)
  await writeUsers(users)
}

export async function deleteUser(id: string): Promise<void> {
  const users = await readUsers()
  if (users.filter(u => u.role === 'admin').length === 1) {
    const user = users.find(u => u.id === id)
    if (user?.role === 'admin') throw new Error('No se puede eliminar el único administrador')
  }
  await writeUsers(users.filter(u => u.id !== id))
}

export function safeUser(u: User) {
  const { password, ...rest } = u
  return rest
}
