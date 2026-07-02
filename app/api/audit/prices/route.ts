import { getData } from '@/lib/data'
import { paginate } from '@/lib/paginate'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const user_name = searchParams.get('user_name')
  const direction = searchParams.get('direction')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('page_size') || '20', 10)

  let data = await getData('audit_prices') as any[]

  if (user_name) {
    const lower = user_name.toLowerCase()
    data = data.filter((r) => String(r.user_name || '').toLowerCase().includes(lower))
  }

  if (direction) {
    const lower = direction.toLowerCase()
    data = data.filter((r) => String(r.direction || '').toLowerCase().includes(lower))
  }

  return NextResponse.json(paginate(data, page, pageSize))
}
