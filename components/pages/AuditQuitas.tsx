'use client'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  AlertTriangle, Clock, Filter, ChevronLeft, ChevronRight,
  TrendingDown, Scissors, ToggleLeft, X, Package, User,
  CreditCard, DollarSign, Receipt, ShoppingBag, ExternalLink
} from 'lucide-react'
import axios from 'axios'
import {
  fetchAuditRemoved, fetchAuditDiscounts, fetchAuditPrices,
  fetchAuditQuantities, fetchAuditInactivations, fetchAuditSummary,
  fetchAuditSuspicious, formatARS, formatNumber, formatDate
} from '@/lib/api'

type Tab = 'removed' | 'discounts' | 'prices' | 'quantities' | 'inactivations'

const TOOLTIP_STYLE = {
  background: '#111118', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, color: '#e2e8f0', fontSize: 12,
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / limit)
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 text-xs text-gray-500">
      <span>Mostrando {Math.min((page-1)*limit+1, total)}–{Math.min(page*limit, total)} de {formatNumber(total)}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page-1)} disabled={page===1} className="p-1.5 rounded hover:bg-dark-700 disabled:opacity-30"><ChevronLeft size={14}/></button>
        <span className="px-2">{page} / {pages}</span>
        <button onClick={() => onPage(page+1)} disabled={page===pages} className="p-1.5 rounded hover:bg-dark-700 disabled:opacity-30"><ChevronRight size={14}/></button>
      </div>
    </div>
  )
}

function UserChart({ data, color = '#ef4444' }: { data: any[]; color?: string }) {
  if (!data?.length) return <p className="text-gray-600 text-xs text-center py-8">Sin datos</p>
  const chart = data.slice(0, 10).map(d => ({ name: (d.user || '').split(' ')[0], count: d.count, monto: Math.round((d.amount || 0)/1000) }))
  const chartHeight = Math.max(180, chart.length * 28)
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={chart} layout="vertical" margin={{ left: 0, right: 30, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category" dataKey="name"
          tick={{ fill: '#d1d5db', fontSize: 11 }}
          axisLine={false} tickLine={false}
          width={90} interval={0}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, n: string) => [n === 'count' ? formatNumber(v) : formatARS(v*1000), n === 'count' ? 'Cantidad' : 'Monto']} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#9ca3af', fontSize: 10, formatter: (v: any) => v > 0 ? formatNumber(v) : '' }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Order Detail Modal ────────────────────────────────────────────────────────
function OrderDetailModal({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!orderId) return
    setOrder(null)
    setLoading(true)
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
      <div
        className="relative bg-dark-800 rounded-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
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
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        {loading && <div className="flex-1 flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}

        {order?.error && (
          <div className="flex-1 flex items-center justify-center py-16 text-gray-500 text-sm">
            No se encontraron datos para el pedido #{orderId}
          </div>
        )}

        {order && !order.error && !loading && (
          <div className="flex-1 overflow-y-auto">
            {/* Order Summary */}
            <div className="grid grid-cols-4 gap-3 p-6 border-b border-white/5">
              {[
                { label: 'Subtotal', value: formatARS(order.subtotal) },
                { label: 'Descuento', value: order.discount > 0 ? `-${formatARS(order.discount)} (${order.discount_percentage.toFixed(1)}%)` : '—', red: order.discount > 0 },
                { label: 'IVA', value: formatARS(order.tax) },
                { label: 'Total', value: formatARS(order.total), bold: true },
              ].map(k => (
                <div key={k.label} className="bg-dark-700 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 mb-1">{k.label}</p>
                  <p className={`text-sm font-bold ${k.red ? 'text-red-400' : k.bold ? 'text-white' : 'text-gray-300'}`}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Payment */}
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

            {/* Items */}
            <div className="px-6 py-4 border-b border-white/5">
              <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-1.5">
                <ShoppingBag size={12}/> Ítems del pedido ({order.items.length})
              </h3>
              <div className="space-y-1">
                {order.items.map((it: any, i: number) => (
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

            {/* Audit Events */}
            {(() => {
              const ev = order.audit_events
              const totalEvents = (ev.removed?.length || 0) + (ev.discounts?.length || 0) + (ev.prices?.length || 0) + (ev.quantities?.length || 0) + (ev.payment_changes?.length || 0)
              if (totalEvents === 0) return (
                <div className="px-6 py-4 text-xs text-gray-600 flex items-center gap-2">
                  <AlertTriangle size={12}/> Sin eventos de auditoría para este pedido
                </div>
              )
              return (
                <div className="px-6 py-4">
                  <h3 className="text-xs font-semibold text-red-400 mb-3 flex items-center gap-1.5">
                    <AlertTriangle size={12}/> Eventos de auditoría ({totalEvents})
                  </h3>
                  <div className="space-y-1.5">
                    {ev.removed?.map((r: any, i: number) => (
                      <div key={`rm-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/8 border border-red-500/15 text-xs">
                        <Scissors size={11} className="text-red-400 shrink-0"/>
                        <span className="text-red-300 font-medium">ÍTEM REMOVIDO</span>
                        <span className="text-gray-400 truncate">{r.product_name}</span>
                        <span className="text-gray-500">×{r.quantity}</span>
                        {r.is_late && <span className="px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 font-semibold shrink-0">TARDE {r.minutes_elapsed?.toFixed(0)}min</span>}
                        <span className="text-red-400 font-medium shrink-0">{formatARS(r.total)}</span>
                        <span className="text-gray-500 shrink-0">"{r.observation || '—'}"</span>
                        <span className="text-gray-600 shrink-0 ml-auto">{r.user_name}</span>
                      </div>
                    ))}
                    {ev.discounts?.map((r: any, i: number) => (
                      <div key={`dc-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/15 text-xs">
                        <TrendingDown size={11} className="text-amber-400 shrink-0"/>
                        <span className="text-amber-300 font-medium">DESCUENTO</span>
                        <span className="text-gray-400">{r.discount_percentage?.toFixed(1)}%</span>
                        <span className="text-amber-400 font-medium">{formatARS(r.discount)}</span>
                        <span className="text-gray-500 shrink-0 ml-auto">{r.user_name}</span>
                      </div>
                    ))}
                    {ev.prices?.map((r: any, i: number) => (
                      <div key={`pr-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/8 border border-orange-500/15 text-xs">
                        <DollarSign size={11} className="text-orange-400 shrink-0"/>
                        <span className="text-orange-300 font-medium">CAMBIO PRECIO</span>
                        <span className="text-gray-400 truncate">{r.product_name}</span>
                        <span className="text-gray-500 line-through">{formatARS(r.old_price)}</span>
                        <span className="text-orange-300">→ {formatARS(r.new_price)}</span>
                        <span className="text-gray-500 shrink-0 ml-auto">{r.user_name}</span>
                      </div>
                    ))}
                    {ev.quantities?.map((r: any, i: number) => (
                      <div key={`qty-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/8 border border-purple-500/15 text-xs">
                        <Filter size={11} className="text-purple-400 shrink-0"/>
                        <span className="text-purple-300 font-medium">CANT. REDUCIDA</span>
                        <span className="text-gray-400 truncate">{r.product_name}</span>
                        <span className="text-gray-500">{r.old_quantity} → {r.new_quantity}</span>
                        <span className="text-purple-400 font-medium">{formatARS(r.total)}</span>
                        <span className="text-gray-500 shrink-0 ml-auto">{r.user_name}</span>
                      </div>
                    ))}
                    {ev.payment_changes?.map((r: any, i: number) => (
                      <div key={`pc-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/8 border border-cyan-500/15 text-xs">
                        <CreditCard size={11} className="text-cyan-400 shrink-0"/>
                        <span className="text-cyan-300 font-medium">CAMBIO PAGO</span>
                        <span className="text-gray-500 truncate">{r.original_payment_type}</span>
                        <span className="text-gray-600">→</span>
                        <span className="text-cyan-300 truncate">{r.modified_payment_type}</span>
                        <span className="text-gray-500 shrink-0 ml-auto">{r.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Removed Items Tab ─────────────────────────────────────────────────────────
function RemovedTab({ summary }: { summary: any }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [filterUser, setFilterUser] = useState('')
  const [lateOnly, setLateOnly] = useState(false)
  const [suspiciousOnly, setSuspiciousOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchAuditRemoved(page, 50, filterUser, lateOnly, suspiciousOnly)
      .then(setData).finally(() => setLoading(false))
  }, [page, filterUser, lateOnly, suspiciousOnly])

  useEffect(() => { load() }, [load])

  const users = summary?.removed_items?.by_user || []
  const chartData = users.slice(0, 10).map((u: any) => ({ name: (u.user||'').split(' ')[0], count: u.count, monto: Math.round((u.amount||0)/1000) }))

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
        <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-1.5"><User size={12} className="text-red-400"/> Quitas por mozo</h4>
        <UserChart data={users} color="#ef4444" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(1) }}
          className="bg-dark-700 border border-white/10 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500">
          <option value="">Todos los usuarios</option>
          {users.map((u: any) => <option key={u.user} value={u.user}>{u.user} ({u.count})</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={lateOnly} onChange={e => { setLateOnly(e.target.checked); setPage(1) }} className="accent-red-500"/>
          <Clock size={12}/> Solo tardías (&gt;15min)
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={suspiciousOnly} onChange={e => { setSuspiciousOnly(e.target.checked); setPage(1) }} className="accent-amber-500"/>
          <AlertTriangle size={12}/> Solo sospechosas ("X" / vacías)
        </label>
        <span className="text-[10px] text-gray-600 ml-auto flex items-center gap-1"><ExternalLink size={10}/> Clic en fila = detalle del pedido</span>
      </div>

      {/* Table */}
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        {loading ? <Spinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-500">
                    <th className="text-left px-4 py-3 font-medium">Fecha/Hora</th>
                    <th className="text-left px-4 py-3 font-medium">Pedido #</th>
                    <th className="text-left px-4 py-3 font-medium">Producto</th>
                    <th className="text-right px-4 py-3 font-medium">Cant.</th>
                    <th className="text-right px-4 py-3 font-medium">Monto</th>
                    <th className="text-right px-4 py-3 font-medium">Tiempo</th>
                    <th className="text-left px-4 py-3 font-medium">Observación</th>
                    <th className="text-left px-4 py-3 font-medium">Mozo</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.items || []).map((r: any) => {
                    const isSuspObs = !r.observation || r.observation === 'X' || r.observation === 'x' || r.observation === 'XX'
                    const rowBg = r.is_late ? 'bg-red-500/5 hover:bg-red-500/10' : isSuspObs ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-white/3'
                    return (
                      <tr key={r.id}
                        onClick={() => setSelectedOrder(String(r.order_id))}
                        className={`border-b border-white/3 cursor-pointer transition-colors ${rowBg}`}>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(r.date_time)}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-indigo-400 font-mono font-medium hover:underline">#{r.order_id}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-200 max-w-[200px] truncate">{r.product_name || '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-400">{r.quantity}</td>
                        <td className="px-4 py-2.5 text-right text-gray-200 font-medium">{r.total != null ? formatARS(r.total) : '—'}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {r.minutes_elapsed != null ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.is_late ? 'bg-red-900/60 text-red-300' : 'bg-dark-600 text-gray-500'}`}>
                              <Clock size={9}/>{r.minutes_elapsed.toFixed(0)}min
                              {r.is_late && ' ⚠'}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={isSuspObs ? 'font-bold text-amber-400' : 'text-gray-400'}>
                            {r.observation || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-indigo-300 font-medium">{r.user_name || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={data?.total || 0} limit={50} onPage={setPage} />
          </>
        )}
      </div>

      <OrderDetailModal orderId={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  )
}

// ── Discounts Tab ─────────────────────────────────────────────────────────────
function DiscountsTab({ summary }: { summary: any }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [filterUser, setFilterUser] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchAuditDiscounts(page, 50, filterUser, filterSource).then(setData).finally(() => setLoading(false))
  }, [page, filterUser, filterSource])

  const users = summary?.discounts?.by_user || []

  return (
    <div className="space-y-4">
      <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
        <h4 className="text-xs font-semibold text-gray-400 mb-3">Descuentos por usuario</h4>
        <UserChart data={users} color="#f59e0b" />
      </div>
      <div className="flex gap-3">
        <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(1) }}
          className="bg-dark-700 border border-white/10 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500">
          <option value="">Todos los usuarios</option>
          {users.map((u: any) => <option key={u.user} value={u.user}>{u.user} ({u.count})</option>)}
        </select>
        <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1) }}
          className="bg-dark-700 border border-white/10 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500">
          <option value="">Todas las fuentes</option>
          <option value="restaurant">Salón</option>
          <option value="delivery">Delivery</option>
        </select>
        <span className="text-[10px] text-gray-600 ml-auto self-center flex items-center gap-1"><ExternalLink size={10}/> Clic en fila = detalle del pedido</span>
      </div>
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        {loading ? <Spinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-white/5 text-gray-500">
                  {['Fecha/Hora','Pedido #','Desc. %','Monto Desc.','Fuente','Observación','Usuario'].map(h =>
                    <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {(data?.items || []).map((r: any) => (
                    <tr key={r.id} onClick={() => setSelectedOrder(String(r.order_id))}
                      className="border-b border-white/3 cursor-pointer hover:bg-white/3 transition-colors">
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(r.date_time)}</td>
                      <td className="px-4 py-2.5 text-indigo-400 font-mono font-medium">#{r.order_id}</td>
                      <td className="px-4 py-2.5"><span className={`font-bold ${(r.discount_percentage||0) > 20 ? 'text-red-400' : 'text-amber-400'}`}>{r.discount_percentage?.toFixed(1)}%</span></td>
                      <td className="px-4 py-2.5 text-gray-200 font-medium">{formatARS(r.discount)}</td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${r.source==='delivery' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>{r.source==='delivery'?'Delivery':'Salón'}</span></td>
                      <td className="px-4 py-2.5 text-gray-400">{r.observation || '—'}</td>
                      <td className="px-4 py-2.5 text-indigo-300 font-medium">{r.user_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={data?.total || 0} limit={50} onPage={setPage} />
          </>
        )}
      </div>
      <OrderDetailModal orderId={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  )
}

// ── Prices Tab ────────────────────────────────────────────────────────────────
function PricesTab({ summary }: { summary: any }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [filterDirection, setFilterDirection] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchAuditPrices(page, 50, '', filterDirection).then(setData).finally(() => setLoading(false))
  }, [page, filterDirection])

  const users = summary?.prices?.by_user || []

  return (
    <div className="space-y-4">
      <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
        <h4 className="text-xs font-semibold text-gray-400 mb-3">Cambios de precio por usuario</h4>
        <UserChart data={users} color="#f97316" />
      </div>
      <div className="flex gap-3">
        <select value={filterDirection} onChange={e => { setFilterDirection(e.target.value); setPage(1) }}
          className="bg-dark-700 border border-white/10 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500">
          <option value="">Todos</option>
          <option value="decrease">Solo bajas de precio</option>
          <option value="increase">Solo subas de precio</option>
        </select>
        <span className="text-[10px] text-gray-600 ml-auto self-center flex items-center gap-1"><ExternalLink size={10}/> Clic = detalle del pedido</span>
      </div>
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        {loading ? <Spinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-white/5 text-gray-500">
                  {['Fecha/Hora','Pedido #','Producto','Precio Ant.','Precio Nuevo','Diferencia','Obs.','Usuario','Fuente'].map(h =>
                    <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {(data?.items || []).map((r: any) => {
                    const diff = (r.new_price || 0) - (r.old_price || 0)
                    return (
                      <tr key={r.id} onClick={() => setSelectedOrder(String(r.order_id))}
                        className={`border-b border-white/3 cursor-pointer transition-colors ${r.direction==='decrease' ? 'bg-red-500/5 hover:bg-red-500/10' : 'bg-green-500/5 hover:bg-green-500/10'}`}>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(r.date_time)}</td>
                        <td className="px-4 py-2.5 text-indigo-400 font-mono font-medium">#{r.order_id}</td>
                        <td className="px-4 py-2.5 text-gray-200 max-w-[150px] truncate">{r.product_name || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 line-through">{formatARS(r.old_price)}</td>
                        <td className="px-4 py-2.5 text-gray-200 font-medium">{formatARS(r.new_price)}</td>
                        <td className="px-4 py-2.5 font-bold whitespace-nowrap">
                          <span className={diff < 0 ? 'text-red-400' : 'text-green-400'}>{diff > 0 ? '+' : ''}{formatARS(diff)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 max-w-[100px] truncate">{r.observation || '—'}</td>
                        <td className="px-4 py-2.5 text-indigo-300 font-medium">{r.user_name}</td>
                        <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] ${r.source==='delivery'?'bg-purple-500/20 text-purple-300':'bg-blue-500/20 text-blue-300'}`}>{r.source==='delivery'?'Del.':'Sal.'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={data?.total || 0} limit={50} onPage={setPage} />
          </>
        )}
      </div>
      <OrderDetailModal orderId={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  )
}

// ── Quantities Tab ─────────────────────────────────────────────────────────────
function QuantitiesTab({ summary }: { summary: any }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchAuditQuantities(page, 50).then(setData).finally(() => setLoading(false))
  }, [page])

  const users = summary?.quantities?.by_user || []

  return (
    <div className="space-y-4">
      <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
        <h4 className="text-xs font-semibold text-gray-400 mb-3">Reducción de cantidades por usuario</h4>
        <UserChart data={users} color="#a855f7" />
      </div>
      <span className="text-[10px] text-gray-600 flex items-center gap-1"><ExternalLink size={10}/> Clic = detalle del pedido</span>
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        {loading ? <Spinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-white/5 text-gray-500">
                  {['Fecha/Hora','Pedido #','Producto','Cant. Ant.','Cant. Nueva','Monto','Observación','Usuario'].map(h =>
                    <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {(data?.items || []).map((r: any) => (
                    <tr key={r.id} onClick={() => setSelectedOrder(String(r.order_id))}
                      className="border-b border-white/3 bg-orange-500/5 hover:bg-orange-500/10 cursor-pointer transition-colors">
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(r.date_time)}</td>
                      <td className="px-4 py-2.5 text-indigo-400 font-mono font-medium">#{r.order_id}</td>
                      <td className="px-4 py-2.5 text-gray-200 max-w-[200px] truncate">{r.product_name || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500 line-through">{r.old_quantity}</td>
                      <td className="px-4 py-2.5 text-orange-300 font-bold">{r.new_quantity}</td>
                      <td className="px-4 py-2.5 text-gray-200">{formatARS(r.total)}</td>
                      <td className="px-4 py-2.5 text-gray-400">{r.observation || '—'}</td>
                      <td className="px-4 py-2.5 text-indigo-300 font-medium">{r.user_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={data?.total || 0} limit={50} onPage={setPage} />
          </>
        )}
      </div>
      <OrderDetailModal orderId={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  )
}

// ── Inactivations Tab ─────────────────────────────────────────────────────────
function InactivationsTab({ summary }: { summary: any }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [filterType, setFilterType] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchAuditInactivations(page, 50, filterType).then(setData).finally(() => setLoading(false))
  }, [page, filterType])

  const users = summary?.inactivations?.by_user || []

  return (
    <div className="space-y-4">
      <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
        <h4 className="text-xs font-semibold text-gray-400 mb-3">Anulaciones por usuario</h4>
        <UserChart data={users} color="#6366f1" />
      </div>
      <div className="flex gap-3">
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}
          className="bg-dark-700 border border-white/10 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500">
          <option value="">Todos los tipos</option>
          <option value="cancel">Solo cancelaciones reales</option>
          <option value="transfer">Solo transferencias de mesa</option>
          <option value="other">Otros</option>
        </select>
        <span className="text-[10px] text-gray-600 ml-auto self-center flex items-center gap-1"><ExternalLink size={10}/> Clic = detalle del pedido</span>
      </div>
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        {loading ? <Spinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-white/5 text-gray-500">
                  {['Fecha/Hora','Pedido #','Tipo','Observación','Usuario'].map(h =>
                    <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {(data?.items || []).map((r: any) => (
                    <tr key={r.id} onClick={() => setSelectedOrder(String(r.order_id))}
                      className={`border-b border-white/3 cursor-pointer hover:bg-white/3 transition-colors ${r.type==='cancel' ? 'bg-red-500/5' : ''}`}>
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(r.date_time)}</td>
                      <td className="px-4 py-2.5 text-indigo-400 font-mono font-medium">#{r.order_id}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${r.type==='cancel' ? 'bg-red-500/20 text-red-300' : r.type==='transfer' ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-500/20 text-gray-400'}`}>
                          {r.type==='cancel'?'Cancelación':r.type==='transfer'?'Transferencia':'Otro'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 max-w-[300px] truncate">{r.observation}</td>
                      <td className="px-4 py-2.5 text-indigo-300 font-medium">{r.user_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={data?.total || 0} limit={50} onPage={setPage} />
          </>
        )}
      </div>
      <OrderDetailModal orderId={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'removed', label: 'Ítems Removidos', icon: Scissors },
  { id: 'discounts', label: 'Descuentos', icon: TrendingDown },
  { id: 'prices', label: 'Precios', icon: DollarSign },
  { id: 'quantities', label: 'Cantidades', icon: Filter },
  { id: 'inactivations', label: 'Anulaciones', icon: ToggleLeft },
]

export default function AuditQuitas() {
  const [tab, setTab] = useState<Tab>('removed')
  const [summary, setSummary] = useState<any>(null)
  const [suspicious, setSuspicious] = useState<any>(null)

  useEffect(() => {
    fetchAuditSummary().then(setSummary)
    fetchAuditSuspicious().then(setSuspicious)
  }, [])

  const ri = summary?.removed_items
  const totalModifications = (ri?.count||0) + (summary?.discounts?.count||0) + (summary?.prices?.count||0) + (summary?.quantities?.count||0)
  const lateCount = ri?.late_count || 0
  const suspObsCount = ri?.suspicious_obs_count || 0

  const kpis = [
    { label: 'Total Modificaciones', value: formatNumber(totalModifications), color: 'border-red-500/40 bg-red-500/5', text: 'text-red-400', sub: 'ítems + descuentos + precios + cantidades' },
    { label: 'Quitas tardías (>15min)', value: formatNumber(lateCount), color: 'border-red-600/50 bg-red-600/5', text: 'text-red-300', sub: ri?.late_amount != null ? formatARS(ri.late_amount) : '—' },
    { label: 'Obs. sospechosa ("X")', value: formatNumber(suspObsCount), color: 'border-amber-500/40 bg-amber-500/5', text: 'text-amber-400', sub: ri?.suspicious_obs_amount != null ? formatARS(ri.suspicious_obs_amount) : '—' },
    { label: 'Descuentos aplicados', value: formatARS(summary?.discounts?.total_amount || 0), color: 'border-yellow-500/40 bg-yellow-500/5', text: 'text-yellow-400', sub: `${formatNumber(summary?.discounts?.count||0)} cambios totales` },
  ]

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <AlertTriangle size={22} className="text-red-400"/>
          Auditoría de Quitas
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Análisis de modificaciones y posibles irregularidades · Clic en cualquier fila para ver el pedido completo</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl p-4 border ${k.color}`}>
            <p className="text-[11px] text-gray-500 mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.text}`}>{k.value}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Suspicious Patterns */}
      {suspicious && (suspicious.high_removals_users?.length > 0 || suspicious.late_removals_count > 0) && (
        <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-300 mb-3 flex items-center gap-2"><AlertTriangle size={14}/> Patrones Sospechosos</h3>
          <div className="grid grid-cols-3 gap-6 text-xs">
            <div>
              <p className="text-gray-500 mb-2">Top removedores</p>
              {suspicious.high_removals_users?.slice(0,5).map((u: any) => (
                <div key={u.user} className="flex justify-between py-0.5">
                  <span className="text-amber-300 font-medium">{u.user}</span>
                  <span className="text-gray-400">{formatNumber(u.count)} ({formatARS(u.amount)})</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-gray-500 mb-2">Quitas tardías por mozo</p>
              {suspicious.late_removals_by_user?.slice(0,5).map((u: any) => (
                <div key={u.user} className="flex justify-between py-0.5">
                  <span className="text-red-300 font-medium">{u.user}</span>
                  <span className="text-gray-400">{formatNumber(u.count)} ({formatARS(u.amount)})</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-gray-500 mb-2">Top descuentos grandes</p>
              {suspicious.large_discounts?.slice(0,5).map((r: any, i: number) => (
                <div key={i} className="flex justify-between py-0.5">
                  <span className="text-yellow-300">{r.user_name} #{r.order_id}</span>
                  <span className="text-gray-400">{r.discount_percentage?.toFixed(0)}% — {formatARS(r.discount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-dark-800 border border-white/5 rounded-xl p-1">
        {TABS.map(t => {
          const Icon = t.icon
          const count = t.id === 'removed' ? summary?.removed_items?.count
            : t.id === 'discounts' ? summary?.discounts?.count
            : t.id === 'prices' ? summary?.prices?.count
            : t.id === 'quantities' ? summary?.quantities?.count
            : summary?.inactivations?.count
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${tab === t.id ? 'bg-dark-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
              <Icon size={12}/>
              {t.label}
              {count != null && <span className={`text-[10px] px-1.5 py-0.5 rounded ${tab === t.id ? 'bg-white/10' : 'bg-dark-700'}`}>{formatNumber(count)}</span>}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {tab === 'removed' && <RemovedTab summary={summary} />}
      {tab === 'discounts' && <DiscountsTab summary={summary} />}
      {tab === 'prices' && <PricesTab summary={summary} />}
      {tab === 'quantities' && <QuantitiesTab summary={summary} />}
      {tab === 'inactivations' && <InactivationsTab summary={summary} />}
    </div>
  )
}
