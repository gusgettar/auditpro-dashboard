import { NextRequest, NextResponse } from 'next/server'
import { deleteUser, updatePassword, findById, safeUser } from '@/lib/users'

function requireAdmin(req: NextRequest) {
  const role = req.headers.get('x-user-role')
  if (role !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  return null
}

// DELETE /api/users/:id
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const err = requireAdmin(req)
  if (err) return err
  try {
    deleteUser(params.id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// PATCH /api/users/:id — change password
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const requestingId = req.headers.get('x-user-id')
  const role = req.headers.get('x-user-role')
  // Admin can change anyone's password; user can change their own
  if (role !== 'admin' && requestingId !== params.id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }
  try {
    const { password } = await req.json()
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }
    await updatePassword(params.id, password)
    const user = findById(params.id)
    return NextResponse.json(user ? safeUser(user) : { ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
