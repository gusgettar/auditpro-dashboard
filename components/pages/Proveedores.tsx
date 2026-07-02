'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Truck, ChevronLeft, ChevronRight, Search, AlertCircle, TrendingUp, ArrowUpDown, X } from 'lucide-react'
import { fetchSuppliersFull, fetchPurchases, formatARS, formatNumber, formatDate } from '@/lib/api'

type SortKey = 'deuda' | 'total' | 'cantidad' | 'nombre'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'deuda', label: 'Mayor deuda' },
  { key: 'total', label: 'Mayor compra' },
  { key: 'cantidad', label: 'Más operaciones' },
  { key: 'nombre', label: 'Nombre A-Z' },
]

function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / limit)
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 text-xs text-gray-500">
      <span>Mostrando {Math.min((page-1)*limit+1, total)}–{Math.min(page*limit, total)} de {formatNumber(total)}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page-1)} disabled={page===1} className="p-1 rounded hover:bg-dark-700 disabled:opacity-30"><ChevronLeft size={14}/></button>
        <span className="px-2">{page} / {pages}</span>
        <button onClick={() => onPage(page+1)} disabled={page===pages} className="p-1 rounded hover:bg-dark-700 disabled:opacity-30"><ChevronRight size={14}/></button>
      </div>
    </div>
  )
}

export default function Proveedores() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string>('')
  const [sortKey, setSortKey] = useState<SortKey>('deuda')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchSuppliersFull()
      .then(d => setSuppliers(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setTableLoading(true)
    fetchPurchases(page, 50, selectedId)
      .then(setPurchases)
      .finally(() => setTableLoading(false))
  }, [page, selectedId])

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...suppliers]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.cuit || '').includes(q))
    }
    switch (sortKey) {
      case 'deuda':   return list.sort((a, b) => Math.abs(b.balance || 0) - Math.abs(a.balance || 0))
      case 'total':   return list.sort((a, b) => (b.purchase_total || 0) - (a.purchase_total || 0))
      case 'cantidad':return list.sort((a, b) => (b.purchase_count || 0) - (a.purchase_count || 0))
      case 'nombre':  return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      default: return list
    }
  }, [suppliers, sortKey, search])

  // KPIs
  const totalComprado = suppliers.reduce((s, x) => s + (x.purchase_total || 0), 0)
  const totalDeuda = suppliers.reduce((s, x) => s + (x.balance < 0 ? Math.abs(x.balance) : 0), 0)
  const conDeuda = suppliers.filter(s => s.balance < -1000)

  // Top 5 deudores for ranking + chart
  const topDeudores = [...suppliers]
    .filter(s => s.balance < -1000)
    .sort((a, b) => a.balance - b.balance) // most negative first
    .slice(0, 5)

  const chartData = topDeudores.map(s => ({
    name: (s.name || '').split(' ').slice(0, 2).join(' '),
    deuda: Math.round(Math.abs(s.balance) / 1000),
  }))

  const maxDeuda = Math.max(...topDeudores.map(s => Math.abs(s.balance || 0)), 1)
  const selectedSupplier = suppliers.find(s => s.party_id === selectedId)

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Truck size={22} className="text-amber-400"/>
          Proveedores
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Compras, saldos y cuenta corriente con proveedores</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Comprado', value: formatARS(totalComprado), color: 'border-amber-500/30', text: 'text-amber-400' },
          { label: 'Deuda Pendiente', value: formatARS(totalDeuda), color: 'border-red-500/30 bg-red-500/5', text: 'text-red-400' },
          { label: 'Proveedores con Deuda', value: String(conDeuda.length), color: 'border-orange-500/30', text: 'text-orange-400' },
          { label: 'Proveedores con Compras', value: String(suppliers.length), color: 'border-white/10', text: 'text-white' },
        ].map(k => (
          <div key={k.label} className={`bg-dark-800 rounded-xl p-4 border ${k.color}`}>
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.text}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Debt Ranking */}
      {topDeudores.length > 0 && (
        <div className="grid grid-cols-5 gap-4">
          {/* Ranking list */}
          <div className="col-span-2 bg-dark-800 rounded-xl p-5 border border-red-500/15 bg-red-500/3">
            <h3 className="text-sm font-semibold text-red-300 mb-4 flex items-center gap-2">
              <AlertCircle size={14}/> Ranking de Deuda
            </h3>
            <div className="space-y-2.5">
              {topDeudores.map((s, i) => (
                <button key={s.party_id} onClick={() => { setSelectedId(s.party_id === selectedId ? '' : s.party_id); setPage(1) }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${s.party_id === selectedId ? 'bg-red-500/15 border border-red-500/25' : 'hover:bg-white/5'}`}>
                  <span className="text-lg font-bold text-red-500/60 w-6 text-center">#{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{s.name}</p>
                    <div className="mt-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${(Math.abs(s.balance || 0) / maxDeuda) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-red-400 shrink-0">{formatARS(Math.abs(s.balance || 0))}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bar chart */}
          <div className="col-span-3 bg-dark-800 rounded-xl p-5 border border-white/5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-amber-400"/> Deuda por proveedor (miles ARS)
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 50, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}K`} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#d1d5db', fontSize: 11 }} axisLine={false} tickLine={false} width={110} interval={0} />
                <Tooltip
                  contentStyle={{ background: '#1a1a26', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
                  formatter={(v: any) => [`$${formatNumber(v)}K`, 'Deuda']}
                />
                <Bar dataKey="deuda" fill="#ef4444" radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fill: '#9ca3af', fontSize: 10, formatter: (v: any) => v > 0 ? `$${formatNumber(v)}K` : '' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proveedor o CUIT..."
            className="bg-dark-700 border border-white/10 text-gray-300 text-xs rounded-lg pl-8 pr-3 py-2 w-56 focus:outline-none focus:border-amber-500 placeholder-gray-600"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X size={12}/></button>}
        </div>

        <div className="flex items-center gap-1 bg-dark-800 border border-white/5 rounded-lg p-1">
          <ArrowUpDown size={12} className="text-gray-500 ml-1.5"/>
          {SORT_OPTIONS.map(o => (
            <button key={o.key} onClick={() => setSortKey(o.key)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${sortKey === o.key ? 'bg-amber-500/20 text-amber-300' : 'text-gray-500 hover:text-gray-300'}`}>
              {o.label}
            </button>
          ))}
        </div>

        {selectedId && (
          <button onClick={() => { setSelectedId(''); setPage(1) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs hover:bg-amber-500/20 transition-colors">
            <X size={11}/> Limpiar filtro: {selectedSupplier?.name}
          </button>
        )}

        <span className="text-xs text-gray-600 ml-auto">{filtered.length} proveedores</span>
      </div>

      {/* Suppliers Table */}
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5 text-gray-500">
              <th className="text-left px-4 py-3 font-medium">Proveedor</th>
              <th className="text-left px-4 py-3 font-medium">CUIT</th>
              <th className="text-right px-4 py-3 font-medium">Compras</th>
              <th className="text-right px-4 py-3 font-medium">Total Comprado</th>
              <th className="text-right px-4 py-3 font-medium">Pagado</th>
              <th className="text-right px-4 py-3 font-medium">Saldo / Deuda</th>
              <th className="text-left px-4 py-3 font-medium">Última Compra</th>
              <th className="text-left px-4 py-3 font-medium">Último Pago</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const debt = s.balance < 0 ? Math.abs(s.balance) : 0
              const isSelected = s.party_id === selectedId
              return (
                <tr key={s.party_id}
                  onClick={() => { setSelectedId(isSelected ? '' : s.party_id); setPage(1) }}
                  className={`border-b border-white/3 cursor-pointer transition-colors ${isSelected ? 'bg-amber-500/8' : debt > 5000000 ? 'bg-red-500/4 hover:bg-red-500/8' : 'hover:bg-white/3'}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-gray-200">{s.name}</p>
                    {s.purchase_count > 0 && <p className="text-[10px] text-gray-600">{s.purchase_count} operaciones</p>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 font-mono">{s.cuit || '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400">{formatNumber(s.purchase_count || 0)}</td>
                  <td className="px-4 py-2.5 text-right text-amber-400 font-medium">{formatARS(s.purchase_total || 0)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400">{formatARS(s.total_paid || 0)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {debt > 0
                      ? <span className="font-bold text-red-400">{formatARS(debt)}</span>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {s.last_purchase_date ? formatDate(s.last_purchase_date) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {s.last_payment_date
                      ? <span className="text-green-400">{formatDate(s.last_payment_date)}</span>
                      : <span className="text-red-500/60 text-[10px] font-medium">Sin pagos</span>}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center text-gray-600 py-10">Sin proveedores</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Purchases detail (when a supplier is selected) */}
      {selectedId && (
        <div className="bg-dark-800 rounded-xl border border-amber-500/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Compras: {selectedSupplier?.name}</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {selectedSupplier?.purchase_count} operaciones · pagado {formatARS(selectedSupplier?.total_paid || 0)} de {formatARS(selectedSupplier?.purchase_total || 0)}
                {selectedSupplier?.balance < 0 && <span className="text-red-400 font-medium"> · Debe {formatARS(Math.abs(selectedSupplier.balance))}</span>}
              </p>
            </div>
          </div>
          {tableLoading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"/></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-white/5 text-gray-500">
                    {['Fecha', 'Factura', 'Subtotal', 'IVA', 'Total', 'Usuario', 'Obs.'].map(h =>
                      <th key={h} className={`py-3 px-4 font-medium ${h === 'Subtotal' || h === 'IVA' || h === 'Total' ? 'text-right' : 'text-left'}`}>{h}</th>
                    )}
                  </tr></thead>
                  <tbody>
                    {(purchases?.items || []).map((r: any) => (
                      <tr key={r.purchase_id} className="border-b border-white/3 hover:bg-white/3">
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(r.date_time)}</td>
                        <td className="px-4 py-2.5 text-gray-500 font-mono">{r.invoice_number || '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-400">{formatARS(r.subtotal)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{formatARS(r.tax)}</td>
                        <td className="px-4 py-2.5 text-right text-amber-400 font-bold">{formatARS(r.total)}</td>
                        <td className="px-4 py-2.5 text-gray-400">{r.user_name}</td>
                        <td className="px-4 py-2.5 text-gray-600 max-w-[120px] truncate">{r.observation || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} total={purchases?.total || 0} limit={50} onPage={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
