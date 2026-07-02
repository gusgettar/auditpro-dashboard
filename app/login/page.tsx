'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChefHat, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If already logged in, redirect
  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.ok) router.replace('/')
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión')
        return
      }
      router.replace('/')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center shadow-xl shadow-indigo-500/30 mb-4">
            <ChefHat size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">AuditPro</h1>
          <p className="text-gray-500 text-sm mt-1">Dashboard de Auditoría</p>
        </div>

        {/* Card */}
        <div className="bg-dark-800 rounded-2xl border border-white/10 p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Usuario</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  placeholder="tu usuario"
                  className="w-full bg-dark-700 border border-white/10 text-gray-200 text-sm rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-indigo-500 placeholder-gray-600 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Contraseña</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-dark-700 border border-white/10 text-gray-200 text-sm rounded-xl pl-9 pr-10 py-3 focus:outline-none focus:border-indigo-500 placeholder-gray-600 transition-colors"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading || !username || !password}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 size={16} className="animate-spin"/> : <Lock size={15}/>}
              {loading ? 'Iniciando sesión...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-700 mt-6">
          © 2026 AuditPro · Acceso restringido
        </p>
      </div>
    </div>
  )
}
