import { getData } from '@/lib/data'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const orderDetails = await getData('order_details') as Record<string, any>
  const order = orderDetails[id]
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [removed, discounts, prices, quantities, paymentChanges, inactivations] = await Promise.all([
    getData('audit_removed'), getData('audit_discounts'), getData('audit_prices'),
    getData('audit_quantities'), getData('audit_payment_types'), getData('audit_inactivations'),
  ])

  return NextResponse.json({
    ...order,
    audit_events: {
      removed: (removed as any[]).filter(r => String(r.order_id) === id),
      discounts: (discounts as any[]).filter(r => String(r.order_id) === id),
      prices: (prices as any[]).filter(r => String(r.order_id) === id),
      quantities: (quantities as any[]).filter(r => String(r.order_id) === id),
      payment_changes: (paymentChanges as any[]).filter(r => String(r.order_id) === id),
      inactivations: (inactivations as any[]).filter(r => String(r.order_id) === id),
    }
  })
}
