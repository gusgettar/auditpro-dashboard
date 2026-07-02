import { getData } from '@/lib/data'
import { paginate } from '@/lib/paginate'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('page_size') || '20', 10)
  let data = await getData('clientes') as any[]
  if (search) {
    const lower = search.toLowerCase()
    data = data.filter((r) =>
      String(r.name || '').toLowerCase().includes(lower) ||
      String(r.document || '').toLowerCase().includes(lower)
    )
  }
  return NextResponse.json(paginate(data, page, pageSize))
}
