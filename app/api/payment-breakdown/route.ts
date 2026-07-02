import { getData } from '@/lib/data'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const data = await getData('payment_breakdown')
  return NextResponse.json(data)
}
