import { clearCache } from '@/lib/data'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (auth !== `Bearer ${process.env.SYNC_SECRET || 'changeme'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  clearCache()
  return NextResponse.json({ ok: true })
}
