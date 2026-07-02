import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'auditpro-secret-change-in-production-min-32-chars'
)
const COOKIE = 'auditpro_session'
const EXPIRES = 60 * 60 * 24 * 7 // 7 days

export interface SessionUser {
  id: string
  username: string
  name: string
  role: 'admin' | 'viewer'
}

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${EXPIRES}s`)
    .setIssuedAt()
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export function getTokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`))
  return match ? match[1] : null
}

export { COOKIE, EXPIRES }
