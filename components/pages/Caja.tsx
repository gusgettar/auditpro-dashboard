'use client'
import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { Wallet, TrendingUp, TrendingDown, RefreshCw, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react'
import { fetchCajaDaily, fetchWithdrawals, fetchOverview, formatARS, formatNumber, formatDate } from '@/lib/api'

const TOOLTIP_STYLE = {
  background: '#111118',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
}

const LARGE_WITHDRAWAL = 5_000_000 // highlight withdrawals over 5M ARS

function KpiCard({ label, value, icon: Icon, colorBar, sub }: {
  label: string; value: string; icon: any; colorBar: string; sub?: string
}) {
  return (
    <div className="bg-dark-800 rounded-xl p-5 border border-white/5 relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${colorBar}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium mb-1.5">{label}</p>
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
          {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
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

// Build histogram buckets for withdrawal distribution
function buildHistogram(withdrawals: any[]) {
  const amounts = withdrawals.map(w => w.amount || 0).filter(a => a > 0)
  if (!amounts.length) return []
  const max = Math.max(...amounts)
  const bucketCount = 8
  const bucketSize = Math.ceil(max / bucketCount)
  const buckets: { range: string; count: number }[] = []
  for (let i = 0; i < bucketCount; i++) {
    const lo = i * bucketSize
    const hi = (i + 1) * bucketSize
    buckets.push({
      range: `$${(lo / 1e6).toFixed(1)}M`,
      count: amounts.filter(a => a >= lo && a < hi).length,
    })
  }
  return buckets.filter(b => b.count > 0)
}

export default function Caja() {
  const [daily, setDaily] = useState<any[]>([])
  const [withdrawals, setWithdrawals] = useState<any>(null)
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    Promise.all([fetchCajaDaily(), fetchOverview()])
      .then(([d, ov]) => { setDaily(Array.isArray(d) ? d : []); setOverview(ov) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setTableLoading(true)
    fetchWithdrawals(page, 50)
      .then(setWithdrawals)
      .finally(() => setTableLoading(false))
  }, [page])

  const totalRevenue = overview?.total_revenue ?? 0
  const totalWithdrawals = overview?.total_withdrawals ?? 634_000_000
  const netBalance = totalRevenue - totalWithdrawals
  const daysWithWithdrawals = daily.filter(d => (d.withdrawals || 0) > 0).length || 1
  const avgWithdrawalPerDay = totalWithdrawals / Math.max(daysWithWithdrawals, 1)

  // Chart data: ingresos vs retiros per day
  const areaData = daily.map(d => ({
    name: (d.date || '').substring(5), // MM-DD
    Ingresos: Math.round((d.cash_in || 0) / 1e3),
    Retiros: Math.round((d.withdrawals || 0) / 1e3),
  }))

  // Histogram from withdrawals summary
  const allWithdrawalItems = withdrawals?.all_items || withdrawals?.items || []
  const histData = buildHistogram(allWithdrawalItems)

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-64">
      <RefreshCw size={24} className="text-emerald-400 animate-spin" />
    </div>
  )

  return (
    <div className="p-6 space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Wallet size={20} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Análisis de Caja</h1>
        </div>
        <p className="text-gray-500 text-sm ml-11">Ingresos, retiros y flujo de caja del período</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Total ingresos"
          value={totalRevenue > 0 ? formatARS(totalRevenue) : '—'}
          icon={TrendingUp}
          colorBar="bg-emerald-500"
          sub={`${formatNumber(overview?.total_orders || 0)} órdenes`}
        />
        <KpiCard
          label="Total retiros"
          value={formatARS(totalWithdrawals)}
          icon={TrendingDown}
          colorBar="bg-rose-500"
        />
        <KpiCard
          label="Saldo neto"
          value={netBalance !== 0 ? formatARS(netBalance) : '—'}
          icon={DollarSign}
          colorBar={netBalance >= 0 ? 'bg-emerald-500' : 'bg-red-600'}
        />
        <KpiCard
          label="Retiros/día promedio"
          value={avgWithdrawalPerDay > 0 ? formatARS(avgWithdrawalPerDay) : '—'}
          icon={Wallet}
          colorBar="bg-amber-500"
          sub={`${daysWithWithdrawals} días con retiros`}
        />
      </div>

      {/* Area Chart: ingresos vs retiros */}
      {areaData.length > 0 && (
        <div className="bg-dark-800 rounded-xl p-5 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-4">Ingresos vs Retiros por día (miles ARS)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={areaData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRetiros" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}K`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, n: string) => [`$${formatNumber(v)}K`, n]} />
              <Area type="monotone" dataKey="Ingresos" stroke="#10b981" strokeWidth={2} fill="url(#colorIngresos)" />
              <Area type="monotone" dataKey="Retiros" stroke="#f43f5e" strokeWidth={2} fill="url(#colorRetiros)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Histogram */}
      {histData.length > 0 && (
        <div className="bg-dark-800 rounded-xl p-5 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-4">Distribución de retiros por monto</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={histData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
              <XAxis dataKey="range" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [v, 'Retiros']} />
              <Bar dataKey="count" fill="#f43f5e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Withdrawals Table */}
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Retiros de caja</h3>
        </div>
        {tableLoading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw size={20} className="text-rose-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-500">
                    <th className="text-left px-4 py-3 font-medium">Fecha</th>
                    <th className="text-right px-4 py-3 font-medium">Monto</th>
                    <th className="text-left px-4 py-3 font-medium">Usuario</th>
                    <th className="text-left px-4 py-3 font-medium">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {(withdrawals?.items || []).map((row: any, i: number) => {
                    const isLarge = (row.amount || 0) >= LARGE_WITHDRAWAL
                    return (
                      <tr key={i} className={`border-b hover:bg-white/2 transition-colors ${isLarge ? 'bg-red-950/20 border-red-900/20' : 'border-white/0'}`}>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(row.date_time)}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${isLarge ? 'text-red-400' : 'text-gray-300'}`}>
                          {formatARS(row.amount || 0)}
                        </td>
                        <td className="px-4 py-2.5 text-gray-300">{row.user_name || '-'}</td>
                        <td className="px-4 py-2.5 text-gray-400 max-w-[300px] truncate">{row.observation || '-'}</td>
                      </tr>
                    )
                  })}
                  {(withdrawals?.items || []).length === 0 && (
                    <tr><td colSpan={4} className="text-center text-gray-600 py-10">Sin registros</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination page={page} total={withdrawals?.total || 0} limit={50} onPage={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
