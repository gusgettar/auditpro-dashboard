import { getData } from '@/lib/data'
import { paginate } from '@/lib/paginate'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('page_size') || '20', 10)

  let data = await getData('audit_inactivations') as any[]

  if (type) {
    const lower = type.toLowerCase()
    data = data.filter((r) => String(r.type || '').toLowerCase().includes(lower))
  }

  return NextResponse.json(paginate(data, page, pageSize))
}
