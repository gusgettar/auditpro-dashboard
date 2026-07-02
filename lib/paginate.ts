export function paginate(arr: any[], page: any, limit: any) {
  const p = Math.max(1, parseInt(String(page)) || 1)
  const l = Math.min(200, Math.max(1, parseInt(String(limit)) || 50))
  const total = arr.length
  return { items: arr.slice((p - 1) * l, p * l), total, page: p, limit: l, pages: Math.ceil(total / l) }
}
