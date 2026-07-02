import { GoogleGenerativeAI } from '@google/generative-ai'
import { getData } from '@/lib/data'
import { NextRequest, NextResponse } from 'next/server'

const GEMINI_TOOLS = [{
  functionDeclarations: [
    {
      name: 'buscar_proveedor',
      description: 'Busca proveedores por nombre y retorna cuenta corriente completa con compras y pagos.',
      parameters: { type: 'OBJECT', properties: { nombre: { type: 'STRING', description: 'Nombre del proveedor (parcial)' } }, required: ['nombre'] }
    },
    {
      name: 'buscar_producto',
      description: 'Busca productos del menú por nombre y retorna precio, costo y receta con ingredientes.',
      parameters: { type: 'OBJECT', properties: { nombre: { type: 'STRING', description: 'Nombre del producto (parcial)' } }, required: ['nombre'] }
    },
    {
      name: 'buscar_cliente',
      description: 'Busca clientes por nombre o documento y retorna saldo de cuenta corriente.',
      parameters: { type: 'OBJECT', properties: { nombre: { type: 'STRING', description: 'Nombre o documento (parcial)' } }, required: ['nombre'] }
    },
    {
      name: 'obtener_pedido',
      description: 'Obtiene detalle completo de un pedido: ítems, pagos y eventos de auditoría.',
      parameters: { type: 'OBJECT', properties: { order_id: { type: 'STRING', description: 'Número de pedido' } }, required: ['order_id'] }
    },
    {
      name: 'buscar_en_retiros',
      description: 'Busca en retiros de caja por descripción o usuario.',
      parameters: { type: 'OBJECT', properties: { texto: { type: 'STRING', description: 'Texto a buscar' }, limite: { type: 'NUMBER' } }, required: ['texto'] }
    },
    {
      name: 'obtener_ventas_periodo',
      description: 'Obtiene ventas diarias para un rango de fechas.',
      parameters: { type: 'OBJECT', properties: { desde: { type: 'STRING', description: 'Fecha inicio YYYY-MM-DD' }, hasta: { type: 'STRING', description: 'Fecha fin YYYY-MM-DD' } }, required: ['desde'] }
    },
    {
      name: 'obtener_quitas_mozo',
      description: 'Obtiene quitas (ítems removidos) de un mozo específico.',
      parameters: { type: 'OBJECT', properties: { usuario: { type: 'STRING' }, limite: { type: 'NUMBER' } }, required: ['usuario'] }
    },
    {
      name: 'listar_proveedores',
      description: 'Lista todos los proveedores con compras, totales y saldos.',
      parameters: { type: 'OBJECT', properties: {} }
    },
  ]
}] as any

async function executeTool(name: string, args: any, allData: any) {
  try {
    switch (name) {
      case 'buscar_proveedor': {
        const q = (args.nombre || '').toLowerCase()
        const matches = (allData.suppliers_full || []).filter((s: any) => (s.name || '').toLowerCase().includes(q))
        return matches.length ? matches : { error: `No se encontró proveedor "${args.nombre}"` }
      }
      case 'buscar_producto': {
        const q = (args.nombre || '').toLowerCase()
        const catalog = (allData.products || []).filter((p: any) => (p.name || '').toLowerCase().includes(q) && !p.inactive).slice(0, 10)
        const recipes = allData.products_recipes || []
        return catalog.map((p: any) => ({ ...p, recipe: recipes.find((r: any) => r.product_id === p.product_id)?.recipe || [] }))
      }
      case 'buscar_cliente': {
        const q = (args.nombre || '').toLowerCase()
        return (allData.clientes || []).filter((c: any) => (c.name || '').toLowerCase().includes(q) || (c.document || '').includes(args.nombre)).slice(0, 10)
      }
      case 'obtener_pedido': {
        const orderDetails = allData.order_details || {}
        const order = orderDetails[String(args.order_id)]
        if (!order) return { error: `Pedido #${args.order_id} no encontrado` }
        return order
      }
      case 'buscar_en_retiros': {
        const q = (args.texto || '').toLowerCase()
        return (allData.withdrawals || []).filter((w: any) => (w.description || '').toLowerCase().includes(q) || (w.user_name || '').toLowerCase().includes(q)).slice(0, args.limite || 20)
      }
      case 'obtener_ventas_periodo': {
        const daily = (allData.daily_sales || []).filter((d: any) => d.date >= args.desde && (!args.hasta || d.date <= args.hasta))
        const total = daily.reduce((s: number, d: any) => s + d.revenue, 0)
        const orders = daily.reduce((s: number, d: any) => s + d.orders, 0)
        return { dias: daily.length, total_ingresos: total, total_pedidos: orders, ticket_promedio: orders > 0 ? total / orders : 0, detalle: daily }
      }
      case 'obtener_quitas_mozo': {
        const q = (args.usuario || '').toLowerCase()
        const quitas = (allData.audit_removed || []).filter((r: any) => (r.user_name || '').toLowerCase().includes(q)).slice(0, args.limite || 50)
        return { usuario: args.usuario, total: quitas.length, quitas }
      }
      case 'listar_proveedores':
        return (allData.suppliers_full || []).filter((s: any) => s.purchase_count > 0).sort((a: any, b: any) => (b.purchase_total || 0) - (a.purchase_total || 0))
      default:
        return { error: `Tool "${name}" no reconocida` }
    }
  } catch (err: any) {
    return { error: err.message }
  }
}

// Module-level prompt cache (5 min)
let _prompt = ''
let _promptUptime = -9999

async function getSystemPrompt(ctx: any): Promise<string> {
  const uptime = process.uptime()
  if (_prompt && (uptime - _promptUptime) < 300) return _prompt
  const findings = (ctx?.notable_findings || []).map((f: string, i: number) => `${i + 1}. ${f}`).join('\n')
  _prompt = `Sos un asistente de auditoría para un restaurante argentino. Tenés acceso completo a la base de datos del sistema POS.

=== RESUMEN ===
${JSON.stringify(ctx?.business_summary || '')}

=== MÉTRICAS ===
${JSON.stringify(ctx?.key_metrics || {})}

=== HALLAZGOS CLAVE ===
${findings}

Respondé SIEMPRE en español rioplatense. Sé directo, específico con fechas y montos. Usá las herramientas para consultas específicas.`
  _promptUptime = uptime
  return _prompt
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    if (!Array.isArray(messages)) return NextResponse.json({ error: 'messages required' }, { status: 400 })

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const ctx = await getData('ai_context')
    const systemPrompt = await getSystemPrompt(ctx)

    // Pre-load data for tool execution
    const [suppliers, products, recipes, clients, withdrawals, auditRemoved, orderDetails, dailySales] = await Promise.all([
      getData('suppliers_full'), getData('products'), getData('products_recipes'),
      getData('clientes'), getData('withdrawals'), getData('audit_removed'),
      getData('order_details'), getData('daily_sales'),
    ])
    const allData = { suppliers_full: suppliers, products, products_recipes: recipes, clientes: clients, withdrawals, audit_removed: auditRemoved, order_details: orderDetails, daily_sales: dailySales }

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt,
      tools: GEMINI_TOOLS,
    })

    // Build history from all messages except last
    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({ history })
    let currentPrompt: any = messages[messages.length - 1].content
    let finalText = ''
    const MAX_ROUNDS = 6

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const result = await chat.sendMessage(currentPrompt)
      const response = result.response
      const parts = response.candidates?.[0]?.content?.parts || []
      const fnCalls = parts.filter((p: any) => p.functionCall)

      if (fnCalls.length === 0) {
        finalText = response.text()
        break
      }

      const functionResponses = []
      for (const part of fnCalls) {
        const { name, args } = part.functionCall
        console.log(`  🔧 Gemini tool: ${name}`)
        const toolResult = await executeTool(name, args || {}, allData)
        functionResponses.push({
          functionResponse: { name, response: { result: JSON.stringify(toolResult) } }
        })
      }
      currentPrompt = functionResponses
    }

    return NextResponse.json({ content: finalText })
  } catch (err: any) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: err.message || 'Error al consultar IA' }, { status: 500 })
  }
}
