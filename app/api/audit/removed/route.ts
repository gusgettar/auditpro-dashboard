import { getData } from '@/lib/data'
import { paginate } from '@/lib/paginate'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const user_name = searchParams.get('user_name')
  const late_only = searchParams.get('late_only')
  const suspicious_only = searchParams.get('suspicious_only')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('page_size') || '20', 10)

  let data = await getData('audit_removed') as any[]

  if (user_name) {
    const lower = user_name.toLowerCase()
    data = data.filter((r) => String(r.user_name || '').toLowerCase().includes(lower))
  }

  if (late_only === 'true' || late_only === '1') {
    data = data.filter((r) => r.is_late === true)
  }

  if (suspicious_only === 'true' || suspicious_only === '1') {
    data = data.filter((r) => {
      const obs = String(r.observation || '').trim().toUpperCase()
      return obs === '' || obs === 'X' || obs === 'XX' || obs === 'NQ' || obs === '-'
    })
  }

  // newest first
  data.sort((a, b) => (b.date_time || '').localeCompare(a.date_time || ''))
  return NextResponse.json(paginate(data, page, pageSize))
}
