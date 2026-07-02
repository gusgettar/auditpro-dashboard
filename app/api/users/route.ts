import { NextRequest, NextResponse } from 'next/server'
import { readUsers, createUser, safeUser } from '@/lib/users'

function requireAdmin(req: NextRequest) {
  if (req.headers.get('x-user-role') !== 'admin')
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const err = requireAdmin(req)
  if (err) return err
  const users = await readUsers()
  return NextResponse.json(users.map(safeUser))
}

export async function POST(req: NextRequest) {
  const err = requireAdmin(req)
  if (err) return err
  try {
    const { username, name, password, role } = await req.json()
    if (!username || !name || !password)
      return NextResponse.json({ error: 'username, name y password son requeridos' }, { status: 400 })
    const user = await createUser(username, name, password, role || 'viewer')
    return NextResponse.json(safeUser(user), { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
