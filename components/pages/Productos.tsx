'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Package, Search, X, Download, FileSpreadsheet, FileText,
  ChevronDown, ChevronUp, Filter, Tag, DollarSign, AlertTriangle,
} from 'lucide-react'
import { fetchProducts, formatARS, formatNumber } from '@/lib/api'
import axios from 'axios'
import toast from 'react-hot-toast'

// ── Types ────────────────────────────────────────────────────────────────────
interface Ingredient { component_id: string; component_name: string; quantity: number; unit_cost: number; current_stock: number }
interface Recipe { product_id: string; name: string; price: number; cost: number; recipe: Ingredient[] }
interface Product { product_id: string; code: string; name: string; rubro_name: string; sub_rubro_name?: string; sub_rubro_id?: string; price: number; cost: number; alicuota: number; inactive: boolean; is_for_sale: boolean }
interface Subrubro { sub_rubro_id: string; name: string; rubro_id: string; rubro_name: string }

// ── Export helpers ────────────────────────────────────────────────────────────
async function exportPDF(recipes: Recipe[], filter: string) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const title = filter ? `Recetas — ${filter}` : 'Recetas de Productos'
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFontSize(18)
  doc.setTextColor(40, 40, 40)
  doc.text(title, 14, 18)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`${recipes.length} productos · Generado ${new Date().toLocaleDateString('es-AR')}`, 14, 25)

  let y = 30
  for (const prod of recipes) {
    if (y > 260) { doc.addPage(); y = 15 }

    // Product header
    doc.setFillColor(30, 30, 50)
    doc.rect(14, y, pageW - 28, 8, 'F')
    doc.setTextColor(220, 220, 220)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`${prod.name}`, 17, y + 5.5)
    const margin = prod.price > 0 ? ((prod.price - prod.cost) / prod.price * 100).toFixed(1) : '0'
    doc.setFontSize(8)
    doc.text(`Precio: $${prod.price.toLocaleString('es-AR')}  |  Costo: $${prod.cost.toLocaleString('es-AR')}  |  Margen: ${margin}%`, pageW - 14, y + 5.5, { align: 'right' })
    y += 10

    if (prod.recipe.length === 0) {
      doc.setTextColor(150); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
      doc.text('Sin ingredientes cargados', 17, y + 4)
      y += 8
    } else {
      autoTable(doc, {
        startY: y,
        head: [['Ingrediente', 'Cantidad', 'Costo Unit.', 'Costo Total', 'Stock']],
        body: prod.recipe.map(ing => [
          ing.component_name,
          ing.quantity.toLocaleString('es-AR'),
          `$${ing.unit_cost.toLocaleString('es-AR')}`,
          `$${(ing.quantity * ing.unit_cost).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`,
          ing.current_stock < 0 ? `⚠ ${ing.current_stock.toLocaleString('es-AR')}` : ing.current_stock.toLocaleString('es-AR'),
        ]),
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [50, 50, 50] },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 248, 252] },
        columnStyles: { 0: { cellWidth: 65 }, 1: { halign: 'right', cellWidth: 22 }, 2: { halign: 'right', cellWidth: 28 }, 3: { halign: 'right', cellWidth: 28 }, 4: { halign: 'right', cellWidth: 25 } },
        margin: { left: 14, right: 14 },
        theme: 'grid',
      })
      y = (doc as any).lastAutoTable.finalY + 6
    }
  }

  doc.save(`recetas${filter ? '-' + filter.toLowerCase().replace(/\s/g, '_') : ''}.pdf`)
}

async function exportExcel(recipes: Recipe[], products: Product[], filter: string) {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  // Sheet 1: Product catalog
  const catalogData = products.map(p => ({
    Código: p.code,
    Nombre: p.name,
    Categoría: p.rubro_name,
    Precio: p.price,
    Costo: p.cost,
    'Margen %': p.price > 0 ? +((p.price - p.cost) / p.price * 100).toFixed(2) : 0,
    IVA: p.alicuota,
    Activo: p.inactive ? 'No' : 'Sí',
    'Para venta': p.is_for_sale ? 'Sí' : 'No',
  }))
  const wsCatalog = XLSX.utils.json_to_sheet(catalogData)
  wsCatalog['!cols'] = [{ wch: 8 }, { wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 6 }, { wch: 8 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsCatalog, 'Catálogo')

  // Sheet 2: All recipes flat
  const recipeRows: any[] = []
  for (const prod of recipes) {
    if (prod.recipe.length === 0) {
      recipeRows.push({ Producto: prod.name, Precio: prod.price, Costo: prod.cost, Ingrediente: '(sin receta)', Cantidad: '', 'Costo Unit.': '', 'Costo Total': '', Stock: '' })
    } else {
      for (const ing of prod.recipe) {
        recipeRows.push({
          Producto: prod.name,
          Precio: prod.price,
          Costo: prod.cost,
          Ingrediente: ing.component_name,
          Cantidad: ing.quantity,
          'Costo Unit.': ing.unit_cost,
          'Costo Total': +(ing.quantity * ing.unit_cost).toFixed(2),
          Stock: ing.current_stock,
        })
      }
    }
  }
  const wsRecipes = XLSX.utils.json_to_sheet(recipeRows)
  wsRecipes['!cols'] = [{ wch: 35 }, { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsRecipes, 'Recetas')

  // Sheet 3: Stock bajo
  const lowStock = []
  for (const prod of recipes) {
    for (const ing of prod.recipe) {
      if (ing.current_stock < 0) {
        lowStock.push({ Producto: prod.name, Ingrediente: ing.component_name, Stock: ing.current_stock })
      }
    }
  }
  if (lowStock.length > 0) {
    const wsLow = XLSX.utils.json_to_sheet(lowStock)
    wsLow['!cols'] = [{ wch: 35 }, { wch: 35 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsLow, 'Stock Negativo')
  }

  XLSX.writeFile(wb, `productos${filter ? '-' + filter.toLowerCase().replace(/\s/g, '_') : ''}.xlsx`)
}

// ── Product Row ───────────────────────────────────────────────────────────────
function ProductRow({ product, recipe, isExpanded, onToggle }: {
  product: Product; recipe: Recipe | undefined; isExpanded: boolean; onToggle: () => void
}) {
  const margin = product.price > 0 ? ((product.price - product.cost) / product.price * 100) : 0
  const marginColor = margin >= 60 ? 'text-green-400' : margin >= 40 ? 'text-yellow-400' : 'text-red-400'
  const hasLowStock = recipe?.recipe.some(i => i.current_stock < 0)

  return (
    <>
      <tr onClick={recipe ? onToggle : undefined}
        className={`border-b border-white/5 transition-colors ${recipe ? 'cursor-pointer hover:bg-dark-700/50' : ''} ${isExpanded ? 'bg-dark-700/40' : ''}`}>
        <td className="px-4 py-3">
          {recipe ? (
            isExpanded ? <ChevronUp size={14} className="text-indigo-400"/> : <ChevronDown size={14} className="text-gray-500"/>
          ) : <span className="w-3.5 h-3.5 inline-block"/>}
        </td>
        <td className="px-3 py-3 text-gray-500 font-mono text-[10px]">{product.code}</td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-200 font-medium">{product.name}</span>
            {hasLowStock && <AlertTriangle size={11} className="text-red-400 shrink-0"/>}
          </div>
        </td>
        <td className="px-3 py-3">
          <span className="px-2 py-0.5 bg-dark-600 rounded-full text-[10px] text-gray-400">{product.rubro_name}</span>
        </td>
        <td className="px-3 py-3">
          {product.sub_rubro_name
            ? <span className="px-2 py-0.5 bg-dark-700 border border-white/10 rounded-full text-[10px] text-gray-500">{product.sub_rubro_name}</span>
            : <span className="text-gray-700 text-[10px]">—</span>}
        </td>
        <td className="px-3 py-3 text-right text-gray-200 font-medium">{formatARS(product.price)}</td>
        <td className="px-3 py-3 text-right text-gray-400">{formatARS(product.cost)}</td>
        <td className={`px-3 py-3 text-right font-bold text-sm ${marginColor}`}>{margin.toFixed(1)}%</td>
        <td className="px-3 py-3 text-center">
          {recipe
            ? <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-300 rounded-full text-[10px]">{recipe.recipe.length} ing.</span>
            : <span className="text-gray-700 text-[10px]">—</span>}
        </td>
        <td className="px-3 py-3 text-center">
          <span className={`w-2 h-2 rounded-full inline-block ${product.inactive ? 'bg-gray-600' : 'bg-green-500'}`}/>
        </td>
      </tr>
      {isExpanded && recipe && (
        <tr className="border-b border-indigo-500/10 bg-dark-700/20">
          <td colSpan={10} className="px-8 py-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-indigo-300 mb-3 flex items-center gap-2">
                <Package size={12}/> Receta: {recipe.name}
                <span className="text-gray-500 font-normal">· Precio {formatARS(recipe.price)} · Costo {formatARS(recipe.cost)}</span>
              </p>
              {recipe.recipe.length === 0 ? (
                <p className="text-xs text-gray-600">Sin ingredientes cargados</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left pb-2 font-medium">Ingrediente</th>
                      <th className="text-right pb-2 font-medium">Cantidad</th>
                      <th className="text-right pb-2 font-medium">Costo unit.</th>
                      <th className="text-right pb-2 font-medium">Costo total</th>
                      <th className="text-right pb-2 font-medium">Stock actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipe.recipe.map((ing, i) => (
                      <tr key={i} className={`border-t border-white/5 ${ing.current_stock < 0 ? 'bg-red-500/5' : ''}`}>
                        <td className="py-1.5 text-gray-300">{ing.component_name}</td>
                        <td className="py-1.5 text-right text-gray-400">{formatNumber(ing.quantity)}</td>
                        <td className="py-1.5 text-right text-gray-400">{formatARS(ing.unit_cost)}</td>
                        <td className="py-1.5 text-right text-gray-300 font-medium">
                          {formatARS(ing.quantity * ing.unit_cost)}
                        </td>
                        <td className={`py-1.5 text-right font-medium ${ing.current_stock < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                          {ing.current_stock < 0 && <AlertTriangle size={10} className="inline mr-1"/>}
                          {formatNumber(ing.current_stock)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Productos() {
  const [products, setProducts] = useState<Product[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [subrubros, setSubrubros] = useState<Subrubro[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedRubro, setSelectedRubro] = useState('')
  const [selectedSubrubro, setSelectedSubrubro] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [onlyWithRecipe, setOnlyWithRecipe] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)

  useEffect(() => {
    Promise.all([
      fetchProducts(),
      axios.get('/api/products-recipes').then(r => r.data),
      axios.get('/api/subrubros').then(r => r.data),
    ]).then(([prods, recs, subs]) => {
      setProducts(Array.isArray(prods) ? prods : [])
      setRecipes(Array.isArray(recs) ? recs : [])
      setSubrubros(Array.isArray(subs) ? subs : [])
    }).finally(() => setLoading(false))
  }, [])

  const recipeMap = useMemo(() => {
    const m: Record<string, Recipe> = {}
    for (const r of recipes) m[r.product_id] = r
    return m
  }, [recipes])

  const rubros = useMemo(() => {
    const seen: Record<string, boolean> = {}
    return products.map(p => p.rubro_name).filter(r => r && !seen[r] && (seen[r] = true)).sort()
  }, [products])

  // Subcategorías filtradas por la categoría seleccionada
  const availableSubrubros = useMemo(() => {
    if (!selectedRubro) return subrubros
    return subrubros.filter(s => s.rubro_name === selectedRubro)
  }, [subrubros, selectedRubro])

  const filtered = useMemo(() => {
    let list = products
    if (!showInactive) list = list.filter(p => !p.inactive)
    if (onlyWithRecipe) list = list.filter(p => !!recipeMap[p.product_id])
    if (selectedRubro) list = list.filter(p => p.rubro_name === selectedRubro)
    if (selectedSubrubro) list = list.filter(p => p.sub_rubro_name === selectedSubrubro)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q))
    }
    return list
  }, [products, search, selectedRubro, selectedSubrubro, showInactive, onlyWithRecipe, recipeMap])

  // Recipes matching current filter for export
  const filteredRecipes = useMemo(() =>
    filtered.map(p => recipeMap[p.product_id]).filter(Boolean) as Recipe[]
  , [filtered, recipeMap])

  // KPIs
  const active = products.filter(p => !p.inactive && p.is_for_sale)
  const withRecipe = products.filter(p => !p.inactive && !!recipeMap[p.product_id])
  const lowStockCount = recipes.reduce((s, r) => s + r.recipe.filter(i => i.current_stock < 0).length, 0)

  const handleExportPDF = async () => {
    if (filteredRecipes.length === 0) {
      toast.error('No hay recetas cargadas para exportar')
      return
    }
    setExporting('pdf')
    try { await exportPDF(filteredRecipes, selectedRubro) }
    catch (err) {
      console.error('Error exportando PDF de recetas:', err)
      toast.error('No se pudo generar el PDF. Reintentá o recargá la página.')
    }
    finally { setExporting(null) }
  }

  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      toast.error('No hay productos para exportar')
      return
    }
    setExporting('excel')
    try { await exportExcel(filteredRecipes, filtered, selectedRubro) }
    catch (err) {
      console.error('Error exportando Excel de productos:', err)
      toast.error('No se pudo generar el Excel. Reintentá o recargá la página.')
    }
    finally { setExporting(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package size={22} className="text-indigo-400"/>
            Productos y Recetas
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Catálogo completo con ingredientes y costos</p>
        </div>
        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} disabled={!!exporting || filteredRecipes.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {exporting === 'pdf' ? <div className="w-3 h-3 border border-red-300 border-t-transparent rounded-full animate-spin"/> : <FileText size={14}/>}
            Exportar PDF
          </button>
          <button onClick={handleExportExcel} disabled={!!exporting || filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {exporting === 'excel' ? <div className="w-3 h-3 border border-green-300 border-t-transparent rounded-full animate-spin"/> : <FileSpreadsheet size={14}/>}
            Exportar Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Productos activos', value: formatNumber(active.length), color: 'border-indigo-500/30', text: 'text-indigo-400' },
          { label: 'Con receta cargada', value: formatNumber(withRecipe.length), color: 'border-purple-500/30', text: 'text-purple-400' },
          { label: 'Rubros / Categorías', value: formatNumber(rubros.length), color: 'border-cyan-500/30', text: 'text-cyan-400' },
          { label: 'Ingredientes stock negativo', value: formatNumber(lowStockCount), color: 'border-red-500/30 bg-red-500/5', text: 'text-red-400' },
        ].map(k => (
          <div key={k.label} className={`bg-dark-800 rounded-xl p-4 border ${k.color}`}>
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.text}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto o código..."
            className="bg-dark-700 border border-white/10 text-gray-300 text-xs rounded-lg pl-8 pr-3 py-2 w-52 focus:outline-none focus:border-indigo-500 placeholder-gray-600"/>
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X size={12}/></button>}
        </div>

        {/* Rubro filter */}
        <div className="flex items-center gap-1.5 bg-dark-700 border border-white/10 rounded-lg px-2.5 py-2">
          <Tag size={12} className="text-gray-500 shrink-0"/>
          <select value={selectedRubro} onChange={e => { setSelectedRubro(e.target.value); setSelectedSubrubro('') }}
            className="bg-transparent text-gray-300 text-xs focus:outline-none">
            <option value="">Todas las categorías</option>
            {rubros.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Subrubro filter — only shows when there are available subrubros */}
        {availableSubrubros.length > 0 && (
          <div className="flex items-center gap-1.5 bg-dark-700 border border-white/10 rounded-lg px-2.5 py-2">
            <Filter size={12} className="text-gray-500 shrink-0"/>
            <select value={selectedSubrubro} onChange={e => setSelectedSubrubro(e.target.value)}
              className="bg-transparent text-gray-300 text-xs focus:outline-none max-w-[180px]">
              <option value="">Todas las subcategorías</option>
              {availableSubrubros.map(s => <option key={s.sub_rubro_id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Toggles */}
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={onlyWithRecipe} onChange={e => setOnlyWithRecipe(e.target.checked)} className="accent-indigo-500"/>
          Solo con receta
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="accent-gray-500"/>
          Incluir inactivos
        </label>

        <span className="text-xs text-gray-600 ml-auto">{filtered.length} productos · {filteredRecipes.length} con receta</span>

        {/* Export hint */}
        {filteredRecipes.length > 0 && (
          <span className="text-[10px] text-gray-600 flex items-center gap-1">
            <Download size={10}/> Exporta {filteredRecipes.length} recetas {selectedRubro ? `de "${selectedRubro}"` : ''}
          </span>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 text-gray-500">
                <th className="px-4 py-3 w-8"/>
                <th className="text-left px-3 py-3 font-medium">Cód.</th>
                <th className="text-left px-3 py-3 font-medium">Producto</th>
                <th className="text-left px-3 py-3 font-medium">Categoría</th>
                <th className="text-left px-3 py-3 font-medium">Subcategoría</th>
                <th className="text-right px-3 py-3 font-medium">Precio</th>
                <th className="text-right px-3 py-3 font-medium">Costo</th>
                <th className="text-right px-3 py-3 font-medium">Margen</th>
                <th className="text-center px-3 py-3 font-medium">Receta</th>
                <th className="text-center px-3 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <ProductRow key={p.product_id}
                  product={p}
                  recipe={recipeMap[p.product_id]}
                  isExpanded={expandedId === p.product_id}
                  onToggle={() => setExpandedId(expandedId === p.product_id ? null : p.product_id)}
                />
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center text-gray-600 py-10">Sin productos</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <p className="text-[11px] text-gray-600">
            Clic en una fila para ver los ingredientes · Filas en rojo = ingrediente con stock negativo
          </p>
          <div className="flex items-center gap-4 text-[10px] text-gray-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Activo</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-600 inline-block"/>Inactivo</span>
            <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-red-400"/>Stock negativo</span>
          </div>
        </div>
      </div>
    </div>
  )
}
