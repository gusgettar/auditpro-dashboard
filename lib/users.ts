import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { put, list } from '@vercel/blob'

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

// ── Read from Blob or local file ──────────────────────────────────────────────
export async function readUsers(): Promise<User[]> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { blobs } = await list({
        prefix: BLOB_PATHNAME,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      const blob = blobs.find(b => b.pathname === BLOB_PATHNAME)
      if (blob) {
        // Cache-bust to always get fresh data
        const res = await fetch(`${blob.url}?_=${Date.now()}`)
        if (res.ok) return res.json()
      }
    } catch (e) {
      console.error('[users] Blob read error:', e)
    }
    // Not in Blob yet — seed from bundled file
    const local = readLocal()
    if (local.length > 0) await writeUsers(local)
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

// ── Write to Blob or local file ───────────────────────────────────────────────
export async function writeUsers(users: User[]): Promise<void> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(BLOB_PATHNAME, JSON.stringify(users, null, 2), {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    })
  } else {
    fs.writeFileSync(LOCAL_PATH, JSON.stringify(users, null, 2))
  }
}

// ── Lookup helpers ────────────────────────────────────────────────────────────
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
  username: string,
  name: string,
  password: string,
  role: 'admin' | 'viewer' = 'viewer'
): Promise<User> {
  const users = await readUsers()
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('El usuario ya existe')
  }
  const hash = await bcrypt.hash(password, 10)
  const newUser: User = {
    id: String(Date.now()),
    username,
    name,
    password: hash,
    role,
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
