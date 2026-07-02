import { getData } from '@/lib/data'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const data = await getData('proveedores')
  return NextResponse.json(data)
}
