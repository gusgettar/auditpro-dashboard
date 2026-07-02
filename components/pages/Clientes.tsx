'use client'
import { useState, useEffect } from 'react'
import { Users, Search, ChevronLeft, ChevronRight, AlertCircle, UserCheck, Wallet, RefreshCw } from 'lucide-react'
import { fetchClientes, formatARS, formatNumber, formatDate } from '@/lib/api'

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 text-xs text-gray-500">
      <span>Página {page} de {pages}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors">
          <ChevronLeft size={14} />
        </button>
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

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

function IvaBadge({ cond }: { cond: string }) {
  const lower = (cond || '').toLowerCase()
  let cls = 'bg-dark-600 text-gray-500'
  if (lower.includes('inscripto')) cls = 'bg-indigo-900/40 text-indigo-300'
  else if (lower.includes('monotrib')) cls = 'bg-cyan-900/40 text-cyan-300'
  else if (lower.includes('consumidor')) cls = 'bg-gray-700/60 text-gray-400'
  else if (lower.includes('exento')) cls = 'bg-purple-900/40 text-purple-300'
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${cls}`}>{cond || '—'}</span>
}

export default function Clientes() {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchClientes(page, 50, search).then(setData).finally(() => setLoading(false))
  }, [page, search])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const clients: any[] = data?.items || []

  // Sort by |balance| descending within the page
  const sortedClients = [...clients].sort((a, b) => Math.abs(b.balance ?? 0) - Math.abs(a.balance ?? 0))

  const withDebt = clients.filter((c: any) => (c.balance ?? 0) < -1000)
  const withCredit = clients.filter((c: any) => (c.balance ?? 0) > 1000)
  const totalReceivable = clients.reduce((sum: number, c: any) => sum + ((c.balance ?? 0) < 0 ? Math.abs(c.balance) : 0), 0)

  const bigDebtors = clients.filter((c: any) => (c.balance ?? 0) < -1_000_000)

  return (
    <div className="p-6 space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-violet-500/10">
            <Users size={20} className="text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
        </div>
        <p className="text-gray-500 text-sm ml-11">Cartera de clientes y saldos de cuenta corriente</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Total clientes"
          value={formatNumber(data?.total || 0)}
          icon={Users}
          colorBar="bg-violet-500"
        />
        <KpiCard
          label="Con saldo activo"
          value={formatNumber(withDebt.length + withCredit.length)}
          icon={UserCheck}
          colorBar="bg-cyan-500"
          sub="en esta página"
        />
        <KpiCard
          label="Cuentas por cobrar"
          value={totalReceivable > 0 ? formatARS(totalReceivable) : '—'}
          icon={Wallet}
          colorBar="bg-rose-500"
          sub="saldos deudores (esta pág.)"
        />
      </div>

      {/* Big debtors alert */}
      {bigDebtors.length > 0 && (
        <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <div className="text-xs text-red-200/80">
            <strong className="text-red-300">Deudas significativas:</strong>{' '}
            {bigDebtors.map((c: any) => `${c.name || c.party_id}: ${formatARS(Math.abs(c.balance))}`).join(' · ')}
          </div>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre o documento..."
            className="w-full bg-dark-700 border border-white/10 text-gray-300 text-xs rounded-lg pl-8 pr-3 py-2.5 focus:outline-none focus:border-violet-500 placeholder-gray-600 transition-colors"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors">
          Buscar
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
            className="px-3 py-2 text-gray-500 hover:text-gray-300 text-xs transition-colors"
          >
            Limpiar
          </button>
        )}
      </form>

      {/* Table */}
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw size={20} className="text-violet-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-500">
                    <th className="text-left px-4 py-3 font-medium">Código</th>
                    <th className="text-left px-4 py-3 font-medium">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium">Documento</th>
                    <th className="text-left px-4 py-3 font-medium">Condición IVA</th>
                    <th className="text-right px-4 py-3 font-medium">Saldo</th>
                    <th className="text-left px-4 py-3 font-medium">Fecha Alta</th>
                    <th className="text-left px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClients.map((c: any, i: number) => {
                    const balance = c.balance ?? 0
                    const isNegative = balance < 0
                    const isPositive = balance > 0
                    return (
                      <tr
                        key={c.party_id || i}
                        className={`border-b hover:bg-white/2 transition-colors ${
                          balance < -1_000_000
                            ? 'bg-red-500/5 border-red-900/20'
                            : isPositive
                            ? 'bg-green-500/3 border-white/0'
                            : 'border-white/0'
                        }`}
                      >
                        <td className="px-4 py-2.5 text-gray-600 font-mono">{c.code || ((page - 1) * 50 + i + 1)}</td>
                        <td className="px-4 py-2.5 text-white font-medium">{c.name || `Cliente ${c.party_id}`}</td>
                        <td className="px-4 py-2.5 text-gray-400 font-mono">{c.document || '—'}</td>
                        <td className="px-4 py-2.5">
                          <IvaBadge cond={c.tax_condition || c.condicion_iva || c.iva_condition || ''} />
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold whitespace-nowrap ${isNegative ? 'text-red-400' : isPositive ? 'text-green-400' : 'text-gray-500'}`}>
                          {balance !== 0 ? formatARS(balance) : '$ 0'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                          {c.date_created ? formatDate(c.date_created) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          {c.is_blocked ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-300">Bloqueado</span>
                          ) : c.is_vip ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300">VIP</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-dark-600 text-gray-500">Normal</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {sortedClients.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-gray-600 py-10">Sin clientes encontrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {data?.pages > 1 && <Pagination page={data.page || page} pages={data.pages} onPage={setPage} />}
          </>
        )}
      </div>
    </div>
  )
}
