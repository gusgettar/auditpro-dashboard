'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import Overview from './pages/Overview'
import Ventas from './pages/Ventas'
import AuditQuitas from './pages/AuditQuitas'
import AuditPagos from './pages/AuditPagos'
import Caja from './pages/Caja'
import Proveedores from './pages/Proveedores'
import Clientes from './pages/Clientes'
import AIChat from './pages/AIChat'
import Productos from './pages/Productos'
import Usuarios from './pages/Usuarios'

const pages: Record<string, React.ComponentType> = {
  overview: Overview,
  ventas: Ventas,
  'audit-quitas': AuditQuitas,
  'audit-pagos': AuditPagos,
  caja: Caja,
  proveedores: Proveedores,
  clientes: Clientes,
  productos: Productos,
  'ai-chat': AIChat,
  usuarios: Usuarios,
}

export default function AppShell() {
  const [activePage, setActivePage] = useState('overview')

  const ActivePage = pages[activePage] ?? Overview

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 overflow-auto">
        <ActivePage />
      </main>
    </div>
  )
}
