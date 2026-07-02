'use client'
import {
  ChefHat, LayoutDashboard, TrendingUp, AlertTriangle, CreditCard,
  Wallet, Truck, Users, Bot, Database, ChevronRight, Package,
  LogOut, UserCog,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type BadgeColor = 'red' | 'amber' | 'indigo' | 'green'

type NavItem = {
  id: string
  label: string
  icon: React.ElementType
  badge?: { text: string; color: BadgeColor }
}

type NavSection = {
  label: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    label: 'GENERAL',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'ventas', label: 'Ventas', icon: TrendingUp },
    ],
  },
  {
    label: 'AUDITORÍA',
    items: [
      {
        id: 'audit-quitas',
        label: 'Quitas & Descuentos',
        icon: AlertTriangle,
        badge: { text: '2.8K', color: 'red' },
      },
      {
        id: 'audit-pagos',
        label: 'Pagos',
        icon: CreditCard,
        badge: { text: '11.5K', color: 'amber' },
      },
    ],
  },
  {
    label: 'OPERACIONES',
    items: [
      { id: 'caja', label: 'Caja', icon: Wallet },
      { id: 'proveedores', label: 'Proveedores', icon: Truck },
      { id: 'clientes', label: 'Clientes', icon: Users },
      { id: 'productos', label: 'Productos y Recetas', icon: Package },
    ],
  },
  {
    label: 'ANÁLISIS IA',
    items: [
      {
        id: 'ai-chat',
        label: 'Chat IA',
        icon: Bot,
        badge: { text: 'BETA', color: 'indigo' },
      },
    ],
  },
]

const badgeClasses: Record<BadgeColor, string> = {
  red: 'bg-red-500/20 text-red-400 border border-red-500/30',
  amber: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  indigo: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
  green: 'bg-green-500/20 text-green-400 border border-green-500/30',
}

interface Props {
  activePage: string
  setActivePage: (page: string) => void
}

export default function Sidebar({ activePage, setActivePage }: Props) {
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; role: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(setUser)
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }

  return (
    <aside
      style={{ width: 280, minWidth: 280 }}
      className="h-full flex flex-col bg-dark-800 border-r border-white/5 shrink-0"
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <ChefHat size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight tracking-wide">AuditPro</p>
            <p className="text-[10px] text-gray-500 leading-tight">Dashboard de Auditoría</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold text-gray-600 tracking-widest px-3 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activePage === item.id
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className={[
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                      isActive
                        ? 'bg-accent/15 text-white border border-accent/25'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent',
                    ].join(' ')}
                  >
                    <Icon
                      size={20}
                      className={isActive ? 'text-accent-light' : 'text-gray-500 group-hover:text-gray-300'}
                    />
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${badgeClasses[item.badge.color]}`}
                      >
                        {item.badge.text}
                      </span>
                    )}
                    {isActive && <ChevronRight size={14} className="text-accent-light/70 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/5 space-y-2">
        {/* DB info */}
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-dark-700/50">
          <Database size={13} className="text-gray-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-gray-500 leading-tight">Base de datos v263</p>
            <p className="text-[9px] text-gray-600 leading-tight">dic 2025 — jun 2026</p>
          </div>
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
        </div>
        {/* User session */}
        {user && (
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-dark-700/50 group">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-indigo-300">{user.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-gray-300 font-medium leading-tight truncate">{user.name}</p>
              <p className="text-[9px] text-gray-600 leading-tight capitalize">{user.role}</p>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {user.role === 'admin' && (
                <button onClick={() => setActivePage('usuarios')} title="Gestión de usuarios"
                  className="p-1 rounded text-gray-600 hover:text-indigo-400 hover:bg-dark-600 transition-colors">
                  <UserCog size={13}/>
                </button>
              )}
              <button onClick={handleLogout} title="Cerrar sesión"
                className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-dark-600 transition-colors">
                <LogOut size={13}/>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
