import { getData } from '@/lib/data'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '10', 10)
  const data = await getData('products') as any[]
  return NextResponse.json(data.slice(0, limit))
}
