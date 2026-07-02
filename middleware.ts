import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'auditpro-secret-change-in-production-min-32-chars'
)
const COOKIE = 'auditpro_session'

async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as any
  } catch { return null }
}

const PUBLIC_PATHS = ['/login', '/api/auth/login']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Get token from cookie
  const token = req.cookies.get('auditpro_session')?.value

  if (!token) {
    // API routes return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    // Pages redirect to login
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const user = await verifyToken(token)
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    }
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete('auditpro_session')
    return res
  }

  // Inject user info into headers for API routes
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-user-id', user.id)
  requestHeaders.set('x-user-role', user.role)
  requestHeaders.set('x-user-name', user.name)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts).*)'],
}
