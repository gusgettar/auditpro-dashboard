'use client'
import { useState, useEffect } from 'react'
import { Users, Plus, Trash2, Key, Shield, Eye, AlertCircle, X, Check, Loader2 } from 'lucide-react'

interface User { id: string; username: string; name: string; role: string; createdAt: string }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
      <div className="relative bg-dark-800 rounded-2xl border border-white/10 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10"><X size={16}/></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full bg-dark-700 border border-white/10 text-gray-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 placeholder-gray-600"

export default function Usuarios() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<any>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [passwordModal, setPasswordModal] = useState<User | null>(null)
  const [deleteModal, setDeleteModal] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  // Create form
  const [form, setForm] = useState({ username: '', name: '', password: '', role: 'viewer' })
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(setMe)
    loadUsers()
  }, [])

  function loadUsers() {
    setLoading(true)
    fetch('/api/users').then(r => r.json()).then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false) })
  }

  function flash(type: 'ok'|'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      flash('ok', `Usuario "${form.username}" creado`)
      setShowCreate(false)
      setForm({ username: '', name: '', password: '', role: 'viewer' })
      loadUsers()
    } catch (err: any) {
      flash('err', err.message)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteModal) return; setSaving(true)
    try {
      const res = await fetch(`/api/users/${deleteModal.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      flash('ok', `Usuario "${deleteModal.username}" eliminado`)
      setDeleteModal(null); loadUsers()
    } catch (err: any) { flash('err', err.message) }
    finally { setSaving(false) }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault(); if (!passwordModal) return; setSaving(true)
    try {
      const res = await fetch(`/api/users/${passwordModal.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      flash('ok', 'Contraseña actualizada')
      setPasswordModal(null); setNewPassword('')
    } catch (err: any) { flash('err', err.message) }
    finally { setSaving(false) }
  }

  const isAdmin = me?.role === 'admin'

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users size={22} className="text-indigo-400"/>Gestión de Usuarios</h1>
          <p className="text-gray-500 text-sm mt-0.5">Administrá el acceso al dashboard</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-xl transition-colors">
            <Plus size={16}/> Nuevo usuario
          </button>
        )}
      </div>

      {/* Flash message */}
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${msg.type === 'ok' ? 'bg-green-500/15 border border-green-500/25 text-green-300' : 'bg-red-500/15 border border-red-500/25 text-red-300'}`}>
          {msg.type === 'ok' ? <Check size={15}/> : <AlertCircle size={15}/>}
          {msg.text}
        </div>
      )}

      {/* Users table */}
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={22} className="text-indigo-400 animate-spin"/></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Usuario', 'Nombre', 'Rol', 'Creado', 'Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={`border-b border-white/3 hover:bg-white/3 ${u.id === me?.id ? 'bg-indigo-500/5' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-gray-200">{u.username}</span>
                    {u.id === me?.id && <span className="ml-2 text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">Tú</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{u.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-700 text-gray-400'}`}>
                      {u.role === 'admin' ? '⚡ Admin' : '👁 Viewer'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setPasswordModal(u); setNewPassword('') }}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors" title="Cambiar contraseña">
                        <Key size={14}/>
                      </button>
                      {isAdmin && u.id !== me?.id && (
                        <button onClick={() => setDeleteModal(u)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar">
                          <Trash2 size={14}/>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-4 py-3 border-t border-white/5 text-xs text-gray-600">
          <Shield size={11} className="inline mr-1"/> Admin: acceso total y gestión de usuarios · Viewer: solo lectura
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <Modal title="Crear nuevo usuario" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Usuario (para iniciar sesión)">
              <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required placeholder="ej: sandra" className={inputCls}/>
            </Field>
            <Field label="Nombre completo">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required placeholder="ej: Sandra González" className={inputCls}/>
            </Field>
            <Field label="Contraseña">
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required minLength={6} placeholder="mínimo 6 caracteres" className={inputCls}/>
            </Field>
            <Field label="Rol">
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                <option value="viewer">Viewer — solo lectura</option>
                <option value="admin">Admin — acceso total</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
                Crear usuario
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Password modal */}
      {passwordModal && (
        <Modal title={`Cambiar contraseña — ${passwordModal.username}`} onClose={() => setPasswordModal(null)}>
          <form onSubmit={handlePassword} className="space-y-4">
            <Field label="Nueva contraseña">
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                required minLength={6} placeholder="mínimo 6 caracteres" className={inputCls} autoFocus/>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setPasswordModal(null)}
                className="flex-1 px-4 py-2.5 bg-dark-700 text-gray-300 text-sm rounded-xl hover:bg-dark-600 transition-colors">Cancelar</button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin"/> : <Key size={14}/>}
                Actualizar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {deleteModal && (
        <Modal title="Confirmar eliminación" onClose={() => setDeleteModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              ¿Eliminás al usuario <strong className="text-white">{deleteModal.username}</strong> ({deleteModal.name})?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)}
                className="flex-1 px-4 py-2.5 bg-dark-700 text-gray-300 text-sm rounded-xl hover:bg-dark-600 transition-colors">Cancelar</button>
              <button onClick={handleDelete} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
                Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
