import { getData } from '@/lib/data'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const data = await getData('sales_by_waiter')
  return NextResponse.json(data)
}
