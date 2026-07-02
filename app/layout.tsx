import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'AuditPro — Dashboard de Auditoría',
  description: 'Dashboard de auditoría para restaurante argentino',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1a1a26', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)' },
            error: { style: { borderColor: 'rgba(239,68,68,0.5)' } },
            success: { style: { borderColor: 'rgba(34,197,94,0.5)' } },
          }}
        />
      </body>
    </html>
  )
}
