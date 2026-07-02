import Anthropic from '@anthropic-ai/sdk'
import { getData } from '@/lib/data'
import { NextRequest, NextResponse } from 'next/server'

// Module-level cache — survives within same Lambda container invocation
let _systemPrompt = ''
let _promptUptime = -1  // process.uptime() snapshot when prompt was cached
const PROMPT_TTL_SECS = 300  // 5 minutes

async function getSystemPrompt(): Promise<string> {
  const uptime = process.uptime()
  if (_systemPrompt && (uptime - _promptUptime) < PROMPT_TTL_SECS) return _systemPrompt
  const ctx = await getData('ai_context')
  const findings = ((ctx as any)?.notable_findings || []).map((f: string, i: number) => `${i+1}. ${f}`).join('\n')
  _systemPrompt = `Sos un asistente de auditoría especializado en análisis de restaurantes argentinos.
Tenés acceso completo a la base de datos del sistema POS del restaurante.

=== DATOS DEL NEGOCIO ===
${JSON.stringify(ctx, null, 2)}

=== TU ROL ===
Tu trabajo es detectar irregularidades, posibles robos, quitas injustificadas, descuentos sin motivo,
modificaciones sospechosas en pedidos y fugas de dinero.
Sé MUY específico: nombrá usuarios concretos, fechas, montos exactos.
Respondé SIEMPRE en español rioplatense, de forma directa y analítica.
Usá números concretos. Si algo es sospechoso, decilo claramente.

=== HALLAZGOS CLAVE ===
${findings}`
  _promptUptime = uptime
  return _systemPrompt
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    if (!Array.isArray(messages)) return NextResponse.json({ error: 'messages required' }, { status: 400 })
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const systemPrompt = await getSystemPrompt()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    })
    const block = response.content[0]
    const text = block && 'text' in block ? block.text : ''
    return NextResponse.json({ content: text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al consultar IA' }, { status: 500 })
  }
}
