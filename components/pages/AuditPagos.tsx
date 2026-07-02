'use client'
import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { CreditCard, RefreshCw, Filter, ChevronLeft, ChevronRight, AlertTriangle, X, Receipt, ShoppingBag, Scissors, TrendingDown, DollarSign, ExternalLink } from 'lucide-react'
import axios from 'axios'
import { fetchAuditPaymentTypes, fetchAuditSummary, formatARS, formatNumber, formatDate } from '@/lib/api'

const TOOLTIP_STYLE = {
  background: '#111118',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
}

// Payment types that are considered "unusual" transitions
const UNUSUAL_PAIRS = new Set([
  'efectivo→mercadopago',
  'mercadopago→efectivo',
  'efectivo→transferencia',
  'transferencia→efectivo',
])

function isUnusual(original: string, modified: string) {
  const key = `${(original || '').toLowerCase()}→${(modified || '').toLowerCase()}`
  return UNUSUAL_PAIRS.has(key)
}

// ── Order Detail Modal (same as AuditQuitas) ──────────────────────────────────
function OrderDetailModal({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!orderId) return
    setOrder(null); setLoading(true)
    axios.get(`/api/orders/${orderId}`)
      .then(r => setOrder(r.data))
      .catch(() => setOrder({ error: true }))
      .finally(() => setLoading(false))
  }, [orderId])

  if (!orderId) return null

  const PAYMENT_LABEL: Record<string, string> = {
    efectivo: 'Efectivo', debito: 'Débito', credito: 'Crédito',
    mercadopago: 'MercadoPago', pedidos_ya: 'PedidosYa',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-dark-800 rounded-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <Receipt size={15} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Pedido #{orderId}</h2>
              {order && !order.error && (
                <p className="text-[11px] text-gray-500">{order.order_type} · {formatDate(order.start_date_time)} · {order.user_name}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"><X size={18} /></button>
        </div>

        {loading && <div className="flex-1 flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}
        {order?.error && <div className="flex-1 flex items-center justify-center py-16 text-gray-500 text-sm">No se encontraron datos para el pedido #{orderId}</div>}

        {order && !order.error && !loading && (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 gap-3 p-6 border-b border-white/5">
              {[
                { label: 'Subtotal', value: formatARS(order.subtotal) },
                { label: 'Descuento', value: order.discount > 0 ? `-${formatARS(order.discount)} (${order.discount_percentage?.toFixed(1)}%)` : '—', red: order.discount > 0 },
                { label: 'IVA', value: formatARS(order.tax) },
                { label: 'Total', value: formatARS(order.total), bold: true },
              ].map(k => (
                <div key={k.label} className="bg-dark-700 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 mb-1">{k.label}</p>
                  <p className={`text-sm font-bold ${k.red ? 'text-red-400' : k.bold ? 'text-white' : 'text-gray-300'}`}>{k.value}</p>
                </div>
              ))}
            </div>
            {order.payment && Object.values(order.payment).some((v: any) => v > 0) && (
              <div className="px-6 py-4 border-b border-white/5">
                <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5"><CreditCard size={12}/> Pago</h3>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(order.payment).filter(([k,v]) => k !== 'total_paid' && (v as number) > 0).map(([k,v]) => (
                    <span key={k} className="px-2.5 py-1 rounded-lg bg-dark-700 text-xs">
                      <span className="text-gray-400">{PAYMENT_LABEL[k] || k}:</span>{' '}
                      <span className="text-gray-200 font-medium">{formatARS(v as number)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="px-6 py-4 border-b border-white/5">
              <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-1.5"><ShoppingBag size={12}/> Ítems del pedido ({order.items?.length || 0})</h3>
              <div className="space-y-1">
                {(order.items || []).map((it: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-dark-700 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-500 w-5 text-right shrink-0">{it.quantity}×</span>
                      <span className="text-xs text-gray-200 truncate">{it.product_name}</span>
                      {it.observation && <span className="text-[10px] text-amber-400 shrink-0">({it.observation})</span>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-[11px] text-gray-500">{formatARS(it.product_price)}/u</span>
                      <span className="text-xs text-gray-200 font-medium">{formatARS(it.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {(() => {
              const ev = order.audit_events || {}
              // payment_changes are already what we clicked — show them separately
              const payChanges = ev.payment_changes || []
              const otherCount = (ev.removed?.length||0) + (ev.discounts?.length||0) + (ev.prices?.length||0) + (ev.quantities?.length||0)
              const hasAnything = otherCount > 0 || payChanges.length > 0
              if (!hasAnything) return (
                <div className="px-6 py-4 text-xs text-gray-600 flex items-center gap-2">
                  <AlertTriangle size={12}/> Sin otros eventos de auditoría en este pedido
                </div>
              )
              return (
                <div className="px-6 py-4 space-y-4">
                  {/* Payment changes for this order */}
                  {payChanges.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-cyan-400 mb-2 flex items-center gap-1.5">
                        <CreditCard size={12}/> Cambios de pago en este pedido ({payChanges.length})
                      </h3>
                      <div className="space-y-1.5">
                        {payChanges.map((r: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/8 border border-cyan-500/15 text-xs">
                            <CreditCard size={11} className="text-cyan-400 shrink-0"/>
                            <span className="text-gray-400 max-w-[160px] truncate">{r.original_payment_type}</span>
                            <span className="text-gray-600">→</span>
                            <span className="text-cyan-300 font-medium max-w-[160px] truncate">{r.modified_payment_type}</span>
                            <span className="text-gray-200 font-medium shrink-0 ml-auto">{formatARS(r.total)}</span>
                            <span className="text-gray-600 shrink-0">{r.username}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Other audit events */}
                  {otherCount > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                        <AlertTriangle size={12}/> Otras modificaciones en este pedido ({otherCount})
                      </h3>
                      <div className="space-y-1.5">
                        {ev.removed?.map((r: any, i: number) => (
                          <div key={`rm-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/8 border border-red-500/15 text-xs">
                            <Scissors size={11} className="text-red-400 shrink-0"/>
                            <span className="text-red-300 font-medium">ÍTEM REMOVIDO</span>
                            <span className="text-gray-400 truncate">{r.product_name}</span>
                            {r.is_late && <span className="px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 font-semibold shrink-0">TARDE {r.minutes_elapsed?.toFixed(0)}min</span>}
                            <span className="text-red-400 font-medium shrink-0">{formatARS(r.total)}</span>
                            <span className="text-gray-600 shrink-0 ml-auto">{r.user_name}</span>
                          </div>
                        ))}
                        {ev.discounts?.map((r: any, i: number) => (
                          <div key={`dc-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/15 text-xs">
                            <TrendingDown size={11} className="text-amber-400 shrink-0"/>
                            <span className="text-amber-300 font-medium">DESCUENTO</span>
                            <span className="text-gray-400">{r.discount_percentage?.toFixed(1)}%</span>
                            <span className="text-amber-400 font-medium">{formatARS(r.discount)}</span>
                            <span className="text-gray-600 shrink-0 ml-auto">{r.user_name}</span>
                          </div>
                        ))}
                        {ev.prices?.map((r: any, i: number) => (
                          <div key={`pr-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/8 border border-orange-500/15 text-xs">
                            <DollarSign size={11} className="text-orange-400 shrink-0"/>
                            <span className="text-orange-300 font-medium">CAMBIO PRECIO</span>
                            <span className="text-gray-400 truncate">{r.product_name}</span>
                            <span className="text-gray-500 line-through">{formatARS(r.old_price)}</span>
                            <span className="text-orange-300">→ {formatARS(r.new_price)}</span>
                            <span className="text-gray-600 shrink-0 ml-auto">{r.user_name}</span>
                          </div>
                        ))}
                        {ev.quantities?.map((r: any, i: number) => (
                          <div key={`qty-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/8 border border-purple-500/15 text-xs">
                            <Filter size={11} className="text-purple-400 shrink-0"/>
                            <span className="text-purple-300 font-medium">CANT. REDUCIDA</span>
                            <span className="text-gray-400 truncate">{r.product_name}</span>
                            <span className="text-gray-500">{r.old_quantity} → {r.new_quantity}</span>
                            <span className="text-purple-400 font-medium shrink-0">{formatARS(r.total)}</span>
                            <span className="text-gray-600 shrink-0 ml-auto">{r.user_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, colorBar }: {
  label: string; value: string; icon: any; colorBar: string
}) {
  return (
    <div className="bg-dark-800 rounded-xl p-5 border border-white/5 relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${colorBar}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium mb-1.5">{label}</p>
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-dark-700">
          <Icon size={18} className="text-gray-400" />
        </div>
      </div>
    </div>
  )
}

function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
      <span>Mostrando {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} de {formatNumber(total)}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1} className="p-1 rounded hover:bg-dark-700 disabled:opacity-30 transition-colors">
          <ChevronLeft size={14} />
        </button>
        <span className="px-2">{page} / {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className="p-1 rounded hover:bg-dark-700 disabled:opacity-30 transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

export default function AuditPagos() {
  const [summary, setSummary] = useState<any>(null)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [user, setUser] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)

  useEffect(() => {
    fetchAuditSummary()
      .then(setSummary)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setTableLoading(true)
    fetchAuditPaymentTypes(page, 50, user)
      .then(setData)
      .finally(() => setTableLoading(false))
  }, [page, user])

  // Fix: actual path is summary.payment_type_changes.by_user
  const pt = summary?.payment_type_changes || {}
  const byUser: any[] = pt.by_user || []
  const users: string[] = byUser.map((r: any) => r.user).filter(Boolean)

  const userChartData = byUser
    .slice(0, 10)
    .map((r: any) => ({
      name: (r.user || 'Desconocido').split(' ')[0],
      cambios: r.count || 0,
    }))

  const monthlyChartData = (pt.monthly || []).map((m: any) => ({
    name: (m.month || '').replace('20', '').replace('-', '/'),
    cambios: m.count || 0,
  }))

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-64">
      <RefreshCw size={24} className="text-indigo-400 animate-spin" />
    </div>
  )

  const totalChanges = pt.count ?? 0

  return (
    <div className="p-6 space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <CreditCard size={20} className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Auditoría de Cambios de Pago</h1>
        </div>
        <p className="text-gray-500 text-sm ml-11">Modificaciones en medios de pago registradas en el sistema</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total cambios de pago" value={formatNumber(totalChanges)} icon={CreditCard} colorBar="bg-indigo-500" />
        <KpiCard label="Usuarios involucrados" value={formatNumber(pt.user_count || users.length)} icon={AlertTriangle} colorBar="bg-amber-500" />
        <KpiCard label="Cambios inusuales" value={formatNumber(pt.unusual_count || 0)} icon={AlertTriangle} colorBar="bg-red-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-5 gap-4">
        {/* Bar: by user */}
        <div className="col-span-2 bg-dark-800 rounded-xl p-5 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-4">Cambios por usuario (top 10)</h3>
          {userChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(220, userChartData.length * 28)}>
              <BarChart data={userChartData} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#d1d5db', fontSize: 11 }} axisLine={false} tickLine={false} width={90} interval={0} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [formatNumber(v), 'Cambios']} />
                <Bar dataKey="cambios" fill="#6366f1" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#9ca3af', fontSize: 10, formatter: (v: any) => v > 0 ? formatNumber(v) : '' }} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-600 text-sm text-center py-12">Sin datos</p>}
        </div>

        {/* Line: monthly trend */}
        <div className="col-span-3 bg-dark-800 rounded-xl p-5 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-4">Tendencia mensual de cambios</h3>
          {monthlyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyChartData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [formatNumber(v), 'Cambios']} />
                <Line type="monotone" dataKey="cambios" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-600 text-sm text-center py-12">Sin datos mensuales</p>}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-dark-800 rounded-lg px-3 py-2 border border-white/5">
          <Filter size={13} className="text-gray-500" />
          <select value={user} onChange={e => { setUser(e.target.value); setPage(1) }}
            className="bg-transparent text-gray-300 text-xs outline-none">
            <option value="">Todos los usuarios</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-600 flex items-center gap-1">
          <ExternalLink size={10}/> Clic en fila = detalle del pedido · Naranja = transición inusual
        </p>
      </div>

      {/* Table */}
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        {tableLoading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw size={20} className="text-indigo-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-500">
                    <th className="text-left px-4 py-3 font-medium">Fecha/Hora</th>
                    <th className="text-left px-4 py-3 font-medium">Pedido #</th>
                    <th className="text-left px-4 py-3 font-medium">Usuario</th>
                    <th className="text-left px-4 py-3 font-medium">Pago Original</th>
                    <th className="text-left px-4 py-3 font-medium">Pago Modificado</th>
                    <th className="text-right px-4 py-3 font-medium">Monto</th>
                    <th className="text-left px-4 py-3 font-medium">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.items || []).map((row: any, i: number) => {
                    const orig = row.original_payment_type || ''
                    const mod = row.modified_payment_type || ''
                    const unusual = isUnusual(orig, mod)
                    return (
                      <tr key={i} onClick={() => setSelectedOrder(String(row.order_id))}
                        className={`border-b cursor-pointer transition-colors ${unusual ? 'bg-amber-950/20 border-amber-900/20 hover:bg-amber-950/30' : 'border-white/0 hover:bg-white/3'}`}>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(row.date_time)}</td>
                        <td className="px-4 py-2.5 text-indigo-400 font-mono font-medium">#{row.order_id}</td>
                        <td className="px-4 py-2.5 text-gray-300 font-medium">{row.username || '-'}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded bg-dark-600 text-gray-400 text-[10px] max-w-[160px] block truncate">
                            {orig || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded font-medium text-[10px] block max-w-[160px] truncate ${unusual ? 'bg-amber-900/50 text-amber-300' : 'bg-indigo-900/40 text-indigo-300'}`}>
                            {mod || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-300 font-medium whitespace-nowrap">
                          {row.total != null ? formatARS(row.total) : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 max-w-[140px] truncate">
                          {unusual && <AlertTriangle size={10} className="inline mr-1 text-amber-400" />}
                          {row.observation || '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {(data?.items || []).length === 0 && (
                    <tr><td colSpan={7} className="text-center text-gray-600 py-10">Sin registros</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination page={page} total={data?.total || 0} limit={50} onPage={setPage} />
            </div>
          </>
        )}
      </div>

      <OrderDetailModal orderId={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  )
}
