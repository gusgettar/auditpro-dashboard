import axios from 'axios'

// In Next.js, API routes are always same-origin /api
const api = axios.create({ baseURL: '/api' })

export default api

// Overview & Sales
export const fetchOverview = () => api.get('/overview').then(r => r.data)
export const fetchMonthlySales = () => api.get('/monthly-sales').then(r => r.data)
export const fetchDailySales = (from?: string, to?: string) =>
  api.get('/daily-sales', { params: { from, to } }).then(r => r.data)
export const fetchTopProducts = (limit = 20) =>
  api.get('/top-products', { params: { limit } }).then(r => r.data)
export const fetchSalesByWaiter = () => api.get('/sales-by-waiter').then(r => r.data)
export const fetchPaymentBreakdown = () => api.get('/payment-breakdown').then(r => r.data)

// Audit
export const fetchAuditSummary = () => api.get('/audit/summary').then(r => r.data)
export const fetchAuditSuspicious = () => api.get('/audit/suspicious').then(r => r.data)

export const fetchAuditRemoved = (page = 1, limit = 50, user = '', lateOnly = false, suspiciousOnly = false) =>
  api.get('/audit/removed', {
    params: {
      page,
      limit,
      user: user || undefined,
      late_only: lateOnly || undefined,
      suspicious_only: suspiciousOnly || undefined,
    },
  }).then(r => r.data)

export const fetchAuditDiscounts = (page = 1, limit = 50, user = '', source = '') =>
  api.get('/audit/discounts', {
    params: { page, limit, user: user || undefined, source: source || undefined },
  }).then(r => r.data)

export const fetchAuditPrices = (page = 1, limit = 50, user = '', direction = '') =>
  api.get('/audit/prices', {
    params: { page, limit, user: user || undefined, direction: direction || undefined },
  }).then(r => r.data)

export const fetchAuditQuantities = (page = 1, limit = 50, user = '') =>
  api.get('/audit/quantities', {
    params: { page, limit, user: user || undefined },
  }).then(r => r.data)

export const fetchAuditPaymentTypes = (page = 1, limit = 50, user = '') =>
  api.get('/audit/payment-types', {
    params: { page, limit, user: user || undefined },
  }).then(r => r.data)

export const fetchAuditInactivations = (page = 1, limit = 50, type = '') =>
  api.get('/audit/inactivations', {
    params: { page, limit, type: type || undefined },
  }).then(r => r.data)

// Caja
export const fetchCajaDaily = () => api.get('/caja/daily').then(r => r.data)
export const fetchWithdrawals = (page = 1, limit = 50) =>
  api.get('/caja/withdrawals', { params: { page, limit } }).then(r => r.data)

// Business
export const fetchProveedores = () => api.get('/proveedores').then(r => r.data)
export const fetchSuppliersFull = () => api.get('/suppliers-full').then(r => r.data)
export const fetchPurchases = (page = 1, limit = 50, supplier = '') =>
  api.get('/purchases', { params: { page, limit, supplier: supplier || undefined } }).then(r => r.data)
export const fetchClientes = (page = 1, limit = 50, search = '') =>
  api.get('/clientes', { params: { page, limit, search: search || undefined } }).then(r => r.data)
export const fetchProducts = () => api.get('/products').then(r => r.data)

// AI Chat
export const sendChatMessage = (messages: { role: string; content: string }[]) =>
  api.post('/chat', { messages }).then(r => r.data)

// Formatters
export const formatARS = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('es-AR').format(value)

export const formatDate = (iso: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
