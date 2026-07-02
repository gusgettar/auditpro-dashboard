import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'

export interface User {
  id: string
  username: string
  name: string
  password: string
  role: 'admin' | 'viewer'
  createdAt: string
}

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')

export function readUsers(): User[] {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function writeUsers(users: User[]): void {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8')
}

export function findByUsername(username: string): User | undefined {
  return readUsers().find(u => u.username.toLowerCase() === username.toLowerCase())
}

export function findById(id: string): User | undefined {
  return readUsers().find(u => u.id === id)
}

export async function createUser(
  username: string,
  name: string,
  password: string,
  role: 'admin' | 'viewer' = 'viewer'
): Promise<User> {
  const users = readUsers()
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
  writeUsers([...users, newUser])
  return newUser
}

export async function updatePassword(id: string, newPassword: string): Promise<void> {
  const users = readUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx === -1) throw new Error('Usuario no encontrado')
  users[idx].password = await bcrypt.hash(newPassword, 10)
  writeUsers(users)
}

export function deleteUser(id: string): void {
  const users = readUsers()
  if (users.filter(u => u.role === 'admin').length === 1) {
    const user = users.find(u => u.id === id)
    if (user?.role === 'admin') throw new Error('No se puede eliminar el único administrador')
  }
  writeUsers(users.filter(u => u.id !== id))
}

export function safeUser(u: User) {
  const { password, ...rest } = u
  return rest
}
