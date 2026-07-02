import { NextRequest, NextResponse } from 'next/server'
import { put, list } from '@vercel/blob'
import path from 'path'
import fs from 'fs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')

  if (!secret || secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const storeId   = process.env.BLOB_READ_WRITE_TOKEN_STORE_ID
  const token     = process.env.BLOB_READ_WRITE_TOKEN
  const tokenRW   = process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN
  const webhookKey = process.env.BLOB_READ_WRITE_TOKEN_WEBHOOK_PUBLIC_KEY
  const effectiveToken = token || tokenRW

  const envStatus = {
    BLOB_READ_WRITE_TOKEN: token ? `set ✓` : 'NOT SET',
    BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN: tokenRW ? `set ✓` : 'NOT SET',
    BLOB_READ_WRITE_TOKEN_STORE_ID: storeId ? `set ✓` : 'NOT SET',
    BLOB_READ_WRITE_TOKEN_WEBHOOK_PUBLIC_KEY: webhookKey ? 'set ✓' : 'NOT SET',
    effective_token_found: effectiveToken ? 'yes ✓' : 'NO ❌',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'set ✓' : 'NOT SET',
    JWT_SECRET: process.env.JWT_SECRET ? 'set ✓' : 'NOT SET',
    SYNC_SECRET: process.env.SYNC_SECRET ? 'set ✓' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  }

  if (!storeId && !effectiveToken) {
    return NextResponse.json({
      error: 'Blob store no conectado — no hay BLOB_READ_WRITE_TOKEN ni BLOB_READ_WRITE_TOKEN_STORE_ID',
      env_status: envStatus,
    }, { status: 500 })
  }

  try {
    const { blobs } = await list({ prefix: 'auditpro-users.json', token: effectiveToken! })
    const existing = blobs.find(b => b.pathname === 'auditpro-users.json')

    if (existing) {
      return NextResponse.json({
        ok: true,
        message: 'users.json ya existe en Blob',
        blob_url: existing.url,
        env_status: envStatus,
      })
    }

    // Seed from bundled file
    const localPath = path.join(process.cwd(), 'data', 'users.json')
    const usersContent = fs.readFileSync(localPath, 'utf-8')
    const users = JSON.parse(usersContent)

    const result = await put('auditpro-users.json', usersContent, {
      access: 'private',
      addRandomSuffix: false,
      token: effectiveToken!,
    })

    return NextResponse.json({
      ok: true,
      message: `users.json subido con ${users.length} usuario(s)`,
      blob_url: result.url,
      env_status: envStatus,
    })
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      env_status: envStatus,
    }, { status: 500 })
  }
}
