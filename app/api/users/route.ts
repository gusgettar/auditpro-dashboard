import { NextRequest, NextResponse } from 'next/server'
import { readUsers, createUser, deleteUser, updatePassword, safeUser } from '@/lib/users'

function requireAdmin(req: NextRequest) {
  const role = req.headers.get('x-user-role')
  if (role !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  return null
}

// GET /api/users — list all users (admin only)
export async function GET(req: NextRequest) {
  const err = requireAdmin(req)
  if (err) return err
  return NextResponse.json(readUsers().map(safeUser))
}

// POST /api/users — create user (admin only)
export async function POST(req: NextRequest) {
  const err = requireAdmin(req)
  if (err) return err
  try {
    const { username, name, password, role } = await req.json()
    if (!username || !name || !password) {
      return NextResponse.json({ error: 'username, name y password son requeridos' }, { status: 400 })
    }
    const user = await createUser(username, name, password, role || 'viewer')
    return NextResponse.json(safeUser(user), { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
