'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  ShoppingCart,
  Receipt,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  fetchDailySales,
  fetchTopProducts,
  fetchSalesByWaiter,
  fetchPaymentBreakdown,
  formatARS,
  formatNumber,
} from '@/lib/api'

// ---- Constants ----

const PAYMENT_COLORS: Record<string, string> = {
  efectivo: '#6366f1',
  mercadopago: '#06b6d4',
  debito: '#8b5cf6',
  credito: '#f97316',
  pedidos_ya: '#10b981',
  uber_eats: '#f59e0b',
  mas_delivery: '#ec4899',
  rappi: '#ef4444',
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  mercadopago: 'MercadoPago',
  debito: 'Débito',
  credito: 'Crédito',
  pedidos_ya: 'PedidosYa',
  uber_eats: 'Uber Eats',
  mas_delivery: 'MasDelivery',
  rappi: 'Rappi',
}

const TIMEFRAMES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'Todo', days: 9999 },
]

const TOOLTIP_STYLE = {
  background: '#111118',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
}

// ---- Generate month options for date range selector ----
function buildMonthOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 24; i >= 0; i--) {
    const d = subMonths(now, i)
    options.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: es }),
    })
  }
  return options
}

// ---- Skeleton ----
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />
}

// ---- KPI Card ----
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accentClass,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accentClass: string
}) {
  return (
    <div className="bg-dark-800 rounded-xl p-5 border border-white/5 hover:border-white/10 transition-colors relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accentClass}`} />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium mb-1.5">{label}</p>
          <p className="text-2xl font-bold text-white tracking-tight truncate">{value}</p>
          {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-lg bg-dark-700 shrink-0 ml-2">
          <Icon size={18} className="text-gray-400" />
        </div>
      </div>
    </div>
  )
}

// ---- Custom Donut Center Label ----
function DonutCenterLabel({
  viewBox,
  total,
}: {
  viewBox?: { cx: number; cy: number }
  total: number
}) {
  if (!viewBox) return null
  const { cx, cy } = viewBox
  const label = formatARS(total)
  // Split into two lines if too long
  const lines = label.length > 12 ? [label.slice(0, label.length / 2), label.slice(label.length / 2)] : [label]
  return (
    <g>
      {lines.map((line, i) => (
        <text
          key={i}
          x={cx}
          y={cy + (i - (lines.length - 1) / 2) * 16}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#e2e8f0"
          fontSize={11}
          fontWeight={600}
        >
          {line}
        </text>
      ))}
    </g>
  )
}

// ---- Main Component ----
export default function Ventas() {
  const monthOptions = useMemo(() => buildMonthOptions(), [])
  const currentMonth = format(new Date(), 'yyyy-MM')
  const sixMonthsAgo = format(subMonths(new Date(), 5), 'yyyy-MM')

  const [fromMonth, setFromMonth] = useState(sixMonthsAgo)
  const [toMonth, setToMonth] = useState(currentMonth)
  const [timeframe, setTimeframe] = useState(30)

  const [daily, setDaily] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [waiters, setWaiters] = useState<any[]>([])
  const [payments, setPayments] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedWaiters, setExpandedWaiters] = useState<Set<string>>(new Set())

  // Derive date range from fromMonth/toMonth for the API
  const fromDate = useMemo(
    () => format(startOfMonth(new Date(fromMonth + '-01')), 'yyyy-MM-dd'),
    [fromMonth]
  )
  const toDate = useMemo(
    () => format(endOfMonth(new Date(toMonth + '-01')), 'yyyy-MM-dd'),
    [toMonth]
  )

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchDailySales(fromDate, toDate),
      fetchTopProducts(20),
      fetchSalesByWaiter(),
      fetchPaymentBreakdown(),
    ])
      .then(([d, tp, w, py]) => {
        setDaily(d)
        setProducts(tp)
        setWaiters(w)
        setPayments(py)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  // ---- Derived data ----

  // Filter daily by timeframe toggle
  const filteredDaily = useMemo(() => {
    if (timeframe >= 9999) return daily
    const cutoff = new Date(Date.now() - timeframe * 864e5).toISOString().slice(0, 10)
    return daily.filter((d) => d.date >= cutoff)
  }, [daily, timeframe])

  const dailyChart = useMemo(
    () =>
      filteredDaily.map((d) => ({
        date: d.date.slice(5), // MM-DD
        Ingresos: Math.round((d.revenue || 0) / 1000), // in thousands
        Pedidos: d.orders || 0,
      })),
    [filteredDaily]
  )

  const totalRevenue = useMemo(
    () => filteredDaily.reduce((s, d) => s + (d.revenue || 0), 0),
    [filteredDaily]
  )
  const totalOrders = useMemo(
    () => filteredDaily.reduce((s, d) => s + (d.orders || 0), 0),
    [filteredDaily]
  )
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const avgDailyOrders = filteredDaily.length > 0 ? Math.round(totalOrders / filteredDaily.length) : 0

  const paymentChart = useMemo(() => {
    if (!payments) return []
    return Object.entries(payments)
      .filter(([, v]) => (v as number) > 0)
      .map(([k, v]) => ({
        name: PAYMENT_LABELS[k] || k,
        value: Math.round(v as number),
        color: PAYMENT_COLORS[k] || '#6366f1',
      }))
      .sort((a, b) => b.value - a.value)
  }, [payments])

  const paymentTotal = useMemo(
    () => paymentChart.reduce((s, p) => s + p.value, 0),
    [paymentChart]
  )

  const waiterChart = useMemo(
    () =>
      [...waiters]
        .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
        .slice(0, 12)
        .map((w) => ({
          name: (w.user_name || '').substring(0, 14),
          fullName: w.user_name || '',
          Ingresos: Math.round((w.revenue || 0) / 1e6),
          Pedidos: w.orders || 0,
        })),
    [waiters]
  )

  const maxProductRevenue = useMemo(
    () => Math.max(...products.map((p) => p.revenue || 0), 1),
    [products]
  )
  const totalProductRevenue = useMemo(
    () => products.reduce((s, p) => s + (p.revenue || 0), 0),
    [products]
  )

  function toggleWaiter(name: string) {
    setExpandedWaiters((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-72" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  // ---- Render ----
  return (
    <div className="p-6 space-y-6 animate-slide-up">
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp size={22} className="text-indigo-400" />
            Análisis de Ventas
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Evolución de ingresos, productos, mozos y medios de pago
          </p>
        </div>

        {/* Date range selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar size={14} />
            Desde
          </div>
          <div className="relative">
            <select
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
              className="appearance-none bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 pr-8 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
          <span className="text-gray-600 text-xs">hasta</span>
          <div className="relative">
            <select
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value)}
              className="appearance-none bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 pr-8 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ---- KPI Row ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Órdenes"
          value={formatNumber(totalOrders)}
          sub="en el período seleccionado"
          icon={ShoppingCart}
          accentClass="bg-indigo-500"
        />
        <KpiCard
          label="Total Recaudado"
          value={formatARS(totalRevenue)}
          sub={`${filteredDaily.length} días con ventas`}
          icon={TrendingUp}
          accentClass="bg-blue-500"
        />
        <KpiCard
          label="Ticket Promedio"
          value={formatARS(avgTicket)}
          sub="por orden"
          icon={Receipt}
          accentClass="bg-cyan-500"
        />
        <KpiCard
          label="Órdenes / día promedio"
          value={`${formatNumber(avgDailyOrders)}`}
          sub="promedio diario"
          icon={Calendar}
          accentClass="bg-purple-500"
        />
      </div>

      {/* ---- Section 1: Evolución de Ventas ---- */}
      <div className="bg-dark-800 rounded-xl p-5 border border-white/5">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-white">Evolución de Ventas</h2>
          {/* Timeframe toggle */}
          <div className="flex gap-1 bg-dark-700 rounded-lg p-1 border border-white/5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.days}
                onClick={() => setTimeframe(tf.days)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  timeframe === tf.days
                    ? 'bg-indigo-500 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {dailyChart.length === 0 ? (
          <div className="flex items-center justify-center h-56 text-gray-600 text-sm">
            <RefreshCw size={16} className="mr-2 opacity-50" />
            Sin datos para el período seleccionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailyChart} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={Math.max(0, Math.floor(dailyChart.length / 10) - 1)}
              />
              {/* Left Y: Revenue in thousands */}
              <YAxis
                yAxisId="left"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}K`}
              />
              {/* Right Y: Orders */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#a78bfa', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: any, name: string) => [
                  name === 'Ingresos' ? `$${formatNumber(v * 1000)}` : formatNumber(v),
                  name === 'Ingresos' ? 'Ingresos' : 'Pedidos',
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="Ingresos"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#gradRevenue)"
                dot={false}
                activeDot={{ r: 4, fill: '#6366f1' }}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="Pedidos"
                stroke="#a78bfa"
                strokeWidth={1.5}
                fill="none"
                dot={false}
                activeDot={{ r: 4, fill: '#a78bfa' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ---- Section 2: Mozos + Pagos ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ventas por Mozo */}
        <div className="bg-dark-800 rounded-xl p-5 border border-white/5">
          <h2 className="text-sm font-semibold text-white mb-5">Ventas por Mozo</h2>
          {waiterChart.length === 0 ? (
            <div className="flex items-center justify-center h-56 text-gray-600 text-sm">
              Sin datos
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, waiterChart.length * 34)}>
              <BarChart
                data={waiterChart}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}M`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: any, name: string) => [
                    name === 'Ingresos' ? formatARS(v * 1e6) : formatNumber(v),
                    name,
                  ]}
                />
                <Bar
                  dataKey="Ingresos"
                  fill="#6366f1"
                  radius={[0, 4, 4, 0]}
                  label={{
                    position: 'right',
                    formatter: (v: any) => `${v}M`,
                    fill: '#6b7280',
                    fontSize: 10,
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Mix de Medios de Pago */}
        <div className="bg-dark-800 rounded-xl p-5 border border-white/5 flex flex-col">
          <h2 className="text-sm font-semibold text-white mb-4">Mix de Medios de Pago</h2>

          {paymentChart.length === 0 ? (
            <div className="flex items-center justify-center flex-1 text-gray-600 text-sm">
              Sin datos
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={paymentChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {paymentChart.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                    {/* Center label via labelLine=false + custom label */}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: any, name: string) => [formatARS(v as number), name]}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center total overlay - static below chart */}
              <div className="text-center -mt-2 mb-3">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider">Total</p>
                <p className="text-base font-bold text-white">{formatARS(paymentTotal)}</p>
              </div>

              {/* Legend */}
              <div className="space-y-2 mt-auto">
                {paymentChart.map((p, i) => {
                  const pct = paymentTotal > 0 ? ((p.value / paymentTotal) * 100).toFixed(1) : '0.0'
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: p.color }}
                        />
                        <span className="text-gray-400 truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        <span className="text-gray-500 tabular-nums">{pct}%</span>
                        <span className="text-gray-200 font-medium tabular-nums w-28 text-right">
                          {formatARS(p.value)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Section 3: Top 20 Productos ---- */}
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Top 20 Productos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-dark-700/40">
                <th className="text-left py-2.5 px-4 text-gray-500 font-medium w-8">#</th>
                <th className="text-left py-2.5 px-4 text-gray-500 font-medium">Producto</th>
                <th className="text-right py-2.5 px-4 text-gray-500 font-medium">Unidades</th>
                <th className="text-right py-2.5 px-4 text-gray-500 font-medium">Revenue</th>
                <th className="text-right py-2.5 px-4 text-gray-500 font-medium">Precio Prom.</th>
                <th className="text-right py-2.5 px-4 text-gray-500 font-medium w-16">% Total</th>
                <th className="py-2.5 px-4 text-gray-500 font-medium w-36">Participación</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => {
                const pct =
                  totalProductRevenue > 0
                    ? ((p.revenue || 0) / totalProductRevenue) * 100
                    : 0
                const avgPrice =
                  p.quantity > 0 ? (p.revenue || 0) / p.quantity : 0
                return (
                  <tr
                    key={i}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-2.5 px-4 text-gray-600 tabular-nums">{i + 1}</td>
                    <td className="py-2.5 px-4 text-gray-200 font-medium max-w-xs truncate">
                      {p.name}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400 text-right tabular-nums">
                      {formatNumber(p.quantity || 0)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-200 text-right font-medium tabular-nums">
                      {formatARS(p.revenue || 0)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400 text-right tabular-nums">
                      {formatARS(avgPrice)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 text-right tabular-nums">
                      {pct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden w-full">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400"
                          style={{
                            width: `${((p.revenue || 0) / maxProductRevenue) * 100}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {products.length === 0 && (
            <div className="flex items-center justify-center py-16 text-gray-600 text-sm">
              Sin productos
            </div>
          )}
        </div>
      </div>

      {/* ---- Section 4: Detalle por Mozo ---- */}
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Detalle por Mozo</h2>
          <p className="text-[11px] text-gray-600 mt-0.5">
            Expandir fila para ver breakdown. Las columnas Quitas y Descuentos enlazan al módulo de Auditoría.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-dark-700/40">
                <th className="text-left py-2.5 px-4 text-gray-500 font-medium w-8" />
                <th className="text-left py-2.5 px-4 text-gray-500 font-medium">Mozo</th>
                <th className="text-right py-2.5 px-4 text-gray-500 font-medium">Órdenes</th>
                <th className="text-right py-2.5 px-4 text-gray-500 font-medium">Revenue</th>
                <th className="text-right py-2.5 px-4 text-gray-500 font-medium">Ticket Prom.</th>
                <th className="text-right py-2.5 px-4 text-gray-500 font-medium">
                  <span
                    className="inline-flex items-center gap-1 text-red-400/80"
                    title="Ver en Auditoría - Quitas"
                  >
                    Quitas
                    <ExternalLink size={10} />
                  </span>
                </th>
                <th className="text-right py-2.5 px-4 text-gray-500 font-medium">
                  <span
                    className="inline-flex items-center gap-1 text-amber-400/80"
                    title="Ver en Auditoría - Descuentos"
                  >
                    Descuentos
                    <ExternalLink size={10} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {waiters.map((w, i) => {
                const isExpanded = expandedWaiters.has(w.user_name)
                const revenueShare =
                  totalRevenue > 0
                    ? (((w.revenue || 0) / totalRevenue) * 100).toFixed(1)
                    : '0.0'
                const isHighRemoval = (w.removals || 0) > 50
                const isHighDiscount = (w.discounts || 0) > 20

                return [
                  <tr
                    key={`row-${i}`}
                    className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer ${
                      isExpanded ? 'bg-indigo-500/5' : ''
                    }`}
                    onClick={() => toggleWaiter(w.user_name)}
                  >
                    <td className="py-2.5 px-4 text-gray-600">
                      <ChevronRight
                        size={13}
                        className={`transition-transform ${isExpanded ? 'rotate-90' : ''} text-gray-500`}
                      />
                    </td>
                    <td className="py-2.5 px-4 text-gray-200 font-medium">{w.user_name}</td>
                    <td className="py-2.5 px-4 text-gray-400 text-right tabular-nums">
                      {formatNumber(w.orders || 0)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-200 font-medium text-right tabular-nums">
                      {formatARS(w.revenue || 0)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400 text-right tabular-nums">
                      {formatARS(w.avg_ticket || 0)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span
                        className={`font-medium ${isHighRemoval ? 'text-red-400' : 'text-gray-500'}`}
                        title="Ver en Auditoría - Ítems Removidos"
                      >
                        {formatNumber(w.removals || 0)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span
                        className={`font-medium ${isHighDiscount ? 'text-amber-400' : 'text-gray-500'}`}
                        title="Ver en Auditoría - Descuentos"
                      >
                        {formatNumber(w.discounts || 0)}
                      </span>
                    </td>
                  </tr>,

                  isExpanded && (
                    <tr key={`expand-${i}`} className="bg-dark-700/30 border-b border-white/[0.03]">
                      <td colSpan={7} className="px-6 py-3">
                        <div className="flex flex-wrap gap-6 text-[11px]">
                          <div>
                            <span className="text-gray-600 block mb-0.5">Participación en ventas</span>
                            <span className="text-indigo-300 font-semibold">{revenueShare}%</span>
                          </div>
                          <div>
                            <span className="text-gray-600 block mb-0.5">Revenue</span>
                            <span className="text-gray-200">{formatARS(w.revenue || 0)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 block mb-0.5">Ticket promedio</span>
                            <span className="text-gray-200">{formatARS(w.avg_ticket || 0)}</span>
                          </div>
                          {(w.removals || 0) > 0 && (
                            <div>
                              <span className="text-gray-600 block mb-0.5">
                                Quitas{' '}
                                <span className="text-red-500/70">(revisar en Auditoría)</span>
                              </span>
                              <span className={`font-medium ${isHighRemoval ? 'text-red-400' : 'text-gray-400'}`}>
                                {formatNumber(w.removals)} ítems removidos
                              </span>
                            </div>
                          )}
                          {(w.discounts || 0) > 0 && (
                            <div>
                              <span className="text-gray-600 block mb-0.5">
                                Descuentos{' '}
                                <span className="text-amber-500/70">(revisar en Auditoría)</span>
                              </span>
                              <span className={`font-medium ${isHighDiscount ? 'text-amber-400' : 'text-gray-400'}`}>
                                {formatNumber(w.discounts)} descuentos aplicados
                              </span>
                            </div>
                          )}
                          <div className="ml-auto">
                            <div className="h-1.5 bg-dark-600 rounded-full w-32 mt-3">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${Math.min(100, parseFloat(revenueShare) * 3)}%` }}
                              />
                            </div>
                            <span className="text-gray-600 text-[10px]">del total de ventas</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ),
                ]
              })}
            </tbody>
          </table>
          {waiters.length === 0 && (
            <div className="flex items-center justify-center py-16 text-gray-600 text-sm">
              Sin datos de mozos
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
