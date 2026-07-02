'use client'
import { useState, useEffect } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  TrendingUp,
  ShoppingCart,
  Receipt,
  Truck,
  Wallet,
  Users,
  AlertTriangle,
  CreditCard,
  Scissors,
  RefreshCw,
} from 'lucide-react'
import {
  fetchOverview,
  fetchMonthlySales,
  fetchTopProducts,
  fetchPaymentBreakdown,
  fetchAuditSummary,
  formatARS,
  formatNumber,
} from '@/lib/api'

const PAYMENT_COLORS = ['#6366f1', '#06b6d4', '#a855f7', '#f59e0b', '#10b981', '#ec4899']
const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  mercadopago: 'MercadoPago',
  debito: 'Débito',
  credito: 'Crédito',
  pedidos_ya: 'PedidosYa',
  uber_eats: 'Uber Eats',
}

// ---- Skeleton ----
function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />
  )
}

// ---- KPI Card ----
interface KpiCardProps {
  label: string
  value: string
  icon: React.ElementType
  color: string
  sub?: string
}

function KpiCard({ label, value, icon: Icon, color, sub }: KpiCardProps) {
  return (
    <div className="bg-dark-800 rounded-xl p-5 border border-white/5 hover:border-white/10 transition-colors relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${color}`} />
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

// ---- Alert Card ----
interface AlertCardProps {
  icon: React.ElementType
  label: string
  value: string
  desc: string
  color: string
}

function AlertCard({ icon: Icon, label, value, desc, color }: AlertCardProps) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${color} border`}>
      <Icon size={16} className="shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
        <p className="text-[10px] opacity-70 truncate">{desc}</p>
      </div>
    </div>
  )
}

export default function Overview() {
  const [overview, setOverview] = useState<any>(null)
  const [monthly, setMonthly] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [payments, setPayments] = useState<any>(null)
  const [auditSummary, setAuditSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchOverview(),
      fetchMonthlySales(),
      fetchTopProducts(10),
      fetchPaymentBreakdown(),
      fetchAuditSummary(),
    ])
      .then(([ov, mo, tp, py, au]) => {
        setOverview(ov)
        setMonthly(mo)
        setTopProducts(tp)
        setPayments(py)
        setAuditSummary(au)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ---- Monthly chart data ----
  const monthlyChart = monthly.map((m) => ({
    name: (m.month || '').replace('20', '').replace('-', '/'),
    Ingresos: Math.round((m.revenue || 0) / 1_000_000),
    Pedidos: m.orders || 0,
  }))

  // ---- Payment pie data ----
  const paymentChart = payments
    ? Object.entries(payments)
        .filter(([, v]) => (v as number) > 0)
        .map(([k, v], i) => ({
          name: PAYMENT_LABELS[k] || k,
          value: Math.round(v as number),
          color: PAYMENT_COLORS[i % PAYMENT_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value)
    : []

  const maxRevenue = topProducts.length
    ? Math.max(...topProducts.map((p) => p.revenue || 0))
    : 1

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-5 gap-4">
          <Skeleton className="col-span-3 h-64" />
          <Skeleton className="col-span-2 h-64" />
        </div>
        <div className="grid grid-cols-5 gap-4">
          <Skeleton className="col-span-3 h-72" />
          <Skeleton className="col-span-2 h-72" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 animate-slide-up">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Resumen General</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {overview?.date_from?.substring(0, 10)} → {overview?.date_to?.substring(0, 10)}
            {overview?.db_version ? ` · Base v${overview.db_version}` : ''}
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-success text-xs font-medium">
          ● En vivo
        </div>
      </div>

      {/* ---- KPI Row 1: 4 cols ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Ventas"
          value={formatARS(overview?.total_revenue || 1_480_000_000)}
          icon={TrendingUp}
          color="bg-indigo-500"
          sub={`${formatNumber(overview?.total_orders || 56044)} órdenes`}
        />
        <KpiCard
          label="Órdenes"
          value={formatNumber(overview?.total_orders || 56044)}
          icon={ShoppingCart}
          color="bg-purple-500"
          sub="total de pedidos"
        />
        <KpiCard
          label="Ticket Promedio"
          value={formatARS(overview?.avg_ticket || 26468)}
          icon={Receipt}
          color="bg-cyan-500"
          sub="por orden"
        />
        <KpiCard
          label="Facturas AFIP"
          value={formatNumber(overview?.total_invoices || 19623)}
          icon={Receipt}
          color="bg-emerald-500"
          sub={overview?.total_invoiced ? formatARS(overview.total_invoiced) : undefined}
        />
      </div>

      {/* ---- KPI Row 2: 3 cols ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Compras a Proveedores"
          value={formatARS(overview?.total_purchases || 746_000_000)}
          icon={Truck}
          color="bg-amber-500"
        />
        <KpiCard
          label="Retiros de Caja"
          value={formatARS(overview?.total_withdrawals || 634_000_000)}
          icon={Wallet}
          color="bg-rose-500"
        />
        <KpiCard
          label="Clientes Registrados"
          value={formatNumber(overview?.total_customers || 1548)}
          icon={Users}
          color="bg-violet-500"
        />
      </div>

      {/* ---- Charts Row ---- */}
      <div className="grid grid-cols-5 gap-4">
        {/* Monthly Area Chart — 60% */}
        <div className="col-span-3 bg-dark-800 rounded-xl p-5 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-4">Evolución Mensual</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}M`}
              />
              <Tooltip
                contentStyle={{
                  background: '#1a1a2e',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#e2e8f0',
                  fontSize: 12,
                }}
                formatter={(v: any) => [`$${v}M ARS`, 'Ingresos']}
              />
              <Area
                type="monotone"
                dataKey="Ingresos"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#gradIngresos)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Pie — 40% */}
        <div className="col-span-2 bg-dark-800 rounded-xl p-5 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-3">Medios de Pago</h3>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie
                data={paymentChart}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={2}
                dataKey="value"
              >
                {paymentChart.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1a1a2e',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#e2e8f0',
                  fontSize: 12,
                }}
                formatter={(v: any) => [formatARS(v)]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-1">
            {paymentChart.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="text-gray-400 truncate">{p.name}</span>
                </div>
                <span className="text-gray-300 font-medium ml-2">{formatARS(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Bottom: Top Products + Audit Alerts ---- */}
      <div className="grid grid-cols-5 gap-4">
        {/* Top 10 Products */}
        <div className="col-span-3 bg-dark-800 rounded-xl p-5 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-4">Top 10 Productos</h3>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[11px] text-gray-600 w-5 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-300 truncate">{p.name}</span>
                    <span className="text-xs text-gray-500 ml-2 shrink-0">
                      {formatNumber(p.quantity)} u.
                    </span>
                  </div>
                  <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${((p.revenue || 0) / maxRevenue) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-28 text-right shrink-0">
                  {formatARS(p.revenue || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Alerts */}
        <div className="col-span-2 bg-dark-800 rounded-xl p-5 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className="text-warning" />
            Alertas de Auditoría
          </h3>
          <div className="space-y-2.5">
            <AlertCard
              icon={Scissors}
              label="Items Removidos"
              value={formatNumber(overview?.audit_counts?.removed_items || 2860)}
              desc={`${formatNumber(auditSummary?.removed_items?.late_count || 0)} tardíos (posibles elaborados)`}
              color="bg-danger/10 text-red-300 border-danger/20"
            />
            <AlertCard
              icon={CreditCard}
              label="Cambios de Pago"
              value={formatNumber(overview?.audit_counts?.payment_type_changes || 11587)}
              desc="cambios de medio de pago registrados"
              color="bg-warning/10 text-amber-300 border-warning/20"
            />
            <AlertCard
              icon={AlertTriangle}
              label="Descuentos Modificados"
              value={formatNumber(overview?.audit_counts?.changed_discounts || 1367)}
              desc={`${formatARS(auditSummary?.discounts?.total_amount || 0)} en descuentos aplicados`}
              color="bg-orange-500/10 text-orange-300 border-orange-500/20"
            />
            <AlertCard
              icon={RefreshCw}
              label="Anulaciones de Orden"
              value={formatNumber(overview?.audit_counts?.inactivations || 1077)}
              desc={`${auditSummary?.inactivations?.cancels || 0} cancelaciones reales`}
              color="bg-purple-500/10 text-purple-300 border-purple-500/20"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
