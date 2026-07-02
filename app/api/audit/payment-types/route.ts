import { getData } from '@/lib/data'
import { paginate } from '@/lib/paginate'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('page_size') || '20', 10)

  let data = await getData('audit_payment_types') as any[]

  if (username) {
    const lower = username.toLowerCase()
    data = data.filter((r) => String(r.username || '').toLowerCase().includes(lower))
  }

  return NextResponse.json(paginate(data, page, pageSize))
}
