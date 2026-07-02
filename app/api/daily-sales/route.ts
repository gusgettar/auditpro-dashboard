import { getData } from '@/lib/data'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  let data = await getData('monthly_sales') as any[]
  if (from) data = data.filter((r) => r.date >= from)
  if (to) data = data.filter((r) => r.date <= to)
  return NextResponse.json(data)
}
