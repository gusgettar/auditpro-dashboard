import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { put, head } from '@vercel/blob'

export interface User {
  id: string
  username: string
  name: string
  password: string
  role: 'admin' | 'viewer'
  createdAt: string
}

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')
const BLOB_KEY = 'auditpro-users.json'
const IS_PROD = !!process.env.BLOB_READ_WRITE_TOKEN

// ── Blob helpers ──────────────────────────────────────────────────────────────
async function readFromBlob(): Promise<User[] | null> {
  try {
    // Try to find the blob
    const info = await head(BLOB_KEY, { token: process.env.BLOB_READ_WRITE_TOKEN! })
    const res = await fetch(info.url)
    if (res.ok) return res.json()
  } catch {}
  return null
}

async function writeToBlob(users: User[]): Promise<void> {
  await put(BLOB_KEY, JSON.stringify(users, null, 2), {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    addRandomSuffix: false,
  })
}

// ── Core read/write ────────────────────────────────────────────────────────────
export async function readUsersAsync(): Promise<User[]> {
  if (IS_PROD) {
    const blobUsers = await readFromBlob()
    if (blobUsers) return blobUsers
    // First deploy: seed from local file into Blob
    const local = readUsersFromDisk()
    if (local.length > 0) await writeToBlob(local)
    return local
  }
  return readUsersFromDisk()
}

function readUsersFromDisk(): User[] {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

async function writeUsersAsync(users: User[]): Promise<void> {
  if (IS_PROD) {
    await writeToBlob(users)
  } else {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8')
  }
}

// Sync wrappers kept for backwards compat in login (which needs sync read)
export function readUsers(): User[] {
  if (IS_PROD) {
    // In production login route, we call readUsersAsync instead
    return readUsersFromDisk()
  }
  return readUsersFromDisk()
}

export function writeUsers(users: User[]): void {
  if (!IS_PROD) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8')
  }
}

export function findByUsername(username: string): User | undefined {
  return readUsersFromDisk().find(u => u.username.toLowerCase() === username.toLowerCase())
}

export function findById(id: string): User | undefined {
  return readUsersFromDisk().find(u => u.id === id)
}

// Async versions used by all API routes
export async function findByUsernameAsync(username: string): Promise<User | undefined> {
  const users = await readUsersAsync()
  return users.find(u => u.username.toLowerCase() === username.toLowerCase())
}

export async function findByIdAsync(id: string): Promise<User | undefined> {
  const users = await readUsersAsync()
  return users.find(u => u.id === id)
}

export async function createUser(
  username: string,
  name: string,
  password: string,
  role: 'admin' | 'viewer' = 'viewer'
): Promise<User> {
  const users = await readUsersAsync()
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
  await writeUsersAsync([...users, newUser])
  return newUser
}

export async function updatePassword(id: string, newPassword: string): Promise<void> {
  const users = await readUsersAsync()
  const idx = users.findIndex(u => u.id === id)
  if (idx === -1) throw new Error('Usuario no encontrado')
  users[idx].password = await bcrypt.hash(newPassword, 10)
  await writeUsersAsync(users)
}

export async function deleteUser(id: string): Promise<void> {
  const users = await readUsersAsync()
  if (users.filter(u => u.role === 'admin').length === 1) {
    const user = users.find(u => u.id === id)
    if (user?.role === 'admin') throw new Error('No se puede eliminar el único administrador')
  }
  await writeUsersAsync(users.filter(u => u.id !== id))
}

export function safeUser(u: User) {
  const { password, ...rest } = u
  return rest
}
