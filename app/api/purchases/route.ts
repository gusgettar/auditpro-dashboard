import { getData } from '@/lib/data'
import { paginate } from '@/lib/paginate'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const supplier = searchParams.get('supplier')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('page_size') || '20', 10)
  let data = await getData('proveedores') as any[]
  if (supplier) {
    const lower = supplier.toLowerCase()
    data = data.filter((r) => String(r.supplier || '').toLowerCase().includes(lower))
  }
  return NextResponse.json(paginate(data, page, pageSize))
}
