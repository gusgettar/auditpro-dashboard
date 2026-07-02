import { NextRequest, NextResponse } from 'next/server'
import { put, list } from '@vercel/blob'
import path from 'path'
import fs from 'fs'

// One-time setup endpoint: seeds users.json to Vercel Blob
// Call this once after deploy: GET /api/admin/setup?secret=YOUR_SYNC_SECRET
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')

  if (!secret || secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  const status = {
    BLOB_READ_WRITE_TOKEN: token ? `set (${token.substring(0, 20)}...)` : 'NOT SET ❌',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'set ✓' : 'NOT SET ❌',
    JWT_SECRET: process.env.JWT_SECRET ? 'set ✓' : 'NOT SET ❌',
    SYNC_SECRET: process.env.SYNC_SECRET ? 'set ✓' : 'NOT SET ❌',
    NODE_ENV: process.env.NODE_ENV,
  }

  if (!token) {
    return NextResponse.json({
      error: 'BLOB_READ_WRITE_TOKEN no está configurado en las env vars de Vercel',
      env_status: status,
    }, { status: 500 })
  }

  try {
    // Check what's already in Blob
    const { blobs } = await list({ token })
    const existingUsers = blobs.find(b => b.pathname === 'auditpro-users.json')

    if (existingUsers) {
      return NextResponse.json({
        ok: true,
        message: 'users.json ya existe en Blob',
        blob_url: existingUsers.url,
        env_status: status,
      })
    }

    // Seed from bundled file
    const localPath = path.join(process.cwd(), 'data', 'users.json')
    const usersContent = fs.readFileSync(localPath, 'utf-8')
    const users = JSON.parse(usersContent)

    const result = await put('auditpro-users.json', usersContent, {
      access: 'public',
      token,
      addRandomSuffix: false,
    })

    return NextResponse.json({
      ok: true,
      message: `users.json subido a Blob con ${users.length} usuario(s)`,
      blob_url: result.url,
      env_status: status,
    })
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      env_status: status,
    }, { status: 500 })
  }
}
