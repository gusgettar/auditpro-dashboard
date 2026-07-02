'use client'
import { useState, useEffect, useRef } from 'react'
import { Bot, Send, User, Loader2, Sparkles } from 'lucide-react'
import { sendChatMessage } from '@/lib/api'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Message = { role: 'user' | 'assistant'; content: string }

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: `Hola! Soy tu asistente de auditoría. Tengo acceso completo a todos los datos de tu base de datos del restaurante (dic 2025 - jun 2026). Podés preguntarme sobre ventas, quitas sospechosas, descuentos injustificados, posibles robos o cualquier irregularidad. ¿En qué te puedo ayudar?`,
}

type QuickCategory = { emoji: string; label: string; questions: string[] }

const QUICK_CATEGORIES: QuickCategory[] = [
  {
    emoji: '🔍',
    label: 'QUITAS & IRREGULARIDADES',
    questions: [
      '¿Quién realizó más quitas injustificadas?',
      '¿Hay ítems removidos después de ser preparados?',
      '¿Qué observaciones son sospechosas en las quitas?',
      'Analizá las quitas del mes de enero 2026',
    ],
  },
  {
    emoji: '💳',
    label: 'PAGOS',
    questions: [
      '¿Por qué hay 11.587 cambios de tipo de pago?',
      '¿Quién cambia más el medio de pago?',
      '¿Hay patrones sospechosos en los cambios de pago?',
    ],
  },
  {
    emoji: '💰',
    label: 'DESCUENTOS',
    questions: [
      '¿Hay descuentos injustificados?',
      '¿Quién aplica más descuentos y por qué?',
    ],
  },
  {
    emoji: '📦',
    label: 'INVENTARIO & ROBOS',
    questions: [
      '¿Hay señales de posible robo o fuga de dinero?',
      '¿Los retiros de caja son consistentes con las ventas?',
      '¿Hay pedidos cancelados de forma sospechosa?',
    ],
  },
]

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isUser ? 'bg-accent' : 'bg-dark-600 border border-white/10'
        }`}
      >
        {isUser ? (
          <User size={15} className="text-white" />
        ) : (
          <Bot size={15} className="text-accent" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed break-words ${
          isUser
            ? 'bg-accent/20 border border-accent/30 text-white rounded-tr-sm'
            : 'bg-dark-700 border border-white/10 text-gray-100 rounded-tl-sm'
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
              em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
              h1: ({ children }) => <h1 className="text-lg font-bold text-white mt-3 mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-bold text-white mt-3 mb-1.5">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-200 mt-2.5 mb-1">{children}</h3>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1.5 text-gray-200">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1.5 text-gray-200">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              hr: () => <hr className="border-white/10 my-3" />,
              code: ({ children }) => <code className="bg-dark-600 text-indigo-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
              pre: ({ children }) => <pre className="bg-dark-600 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-gray-200">{children}</pre>,
              blockquote: ({ children }) => <blockquote className="border-l-2 border-indigo-400 pl-3 my-2 text-gray-400 italic">{children}</blockquote>,
              table: ({ children }) => (
                <div className="overflow-x-auto my-3">
                  <table className="w-full text-xs border-collapse">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-dark-600">{children}</thead>,
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => <tr className="border-b border-white/10">{children}</tr>,
              th: ({ children }) => <th className="text-left px-3 py-2 font-semibold text-gray-200 whitespace-nowrap">{children}</th>,
              td: ({ children }) => <td className="px-3 py-1.5 text-gray-300">{children}</td>,
              a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">{children}</a>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}

function LoadingBubble() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-dark-600 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={15} className="text-accent" />
      </div>
      <div className="bg-dark-700 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2.5">
        <span className="flex gap-1 items-center">
          <span
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '900ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: '180ms', animationDuration: '900ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: '360ms', animationDuration: '900ms' }}
          />
        </span>
        <span className="text-xs text-gray-500">Analizando datos...</span>
      </div>
    </div>
  )
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: Message = { role: 'user', content }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      // Build API payload excluding the synthetic initial greeting
      const apiMessages = updatedMessages
        .filter(m => m !== INITIAL_MESSAGE)
        .map(m => ({ role: m.role, content: m.content }))

      const result = await sendChatMessage(apiMessages)
      setMessages(prev => [...prev, { role: 'assistant', content: result.content }])
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error ||
          'Error al conectar con la IA. Verificá que ANTHROPIC_API_KEY esté configurada.',
        { duration: 5000 }
      )
      // Roll back the user message on error
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && e.ctrlKey)) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex" style={{ height: '100vh' }}>
      {/* ── Left panel: Quick questions (30%) ─────────────────────────── */}
      <aside className="w-[30%] max-w-xs shrink-0 border-r border-white/5 bg-dark-800 flex flex-col">
        {/* Panel header */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-accent" />
            <h3 className="text-sm font-semibold text-white">Análisis Rápido</h3>
          </div>
          <p className="text-[11px] text-gray-500">Consultas Frecuentes</p>
        </div>

        {/* Categories */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {QUICK_CATEGORIES.map(cat => (
            <div key={cat.label}>
              {/* Category label */}
              <div className="flex items-center gap-1.5 mb-2.5 px-1">
                <span className="text-sm leading-none">{cat.emoji}</span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500">
                  {cat.label}
                </span>
              </div>

              {/* Buttons */}
              <div className="space-y-1.5">
                {cat.questions.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    disabled={loading}
                    className="w-full text-left text-xs text-gray-300 bg-dark-700 hover:bg-dark-600 rounded-lg p-3 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed leading-relaxed"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Panel footer */}
        <div className="px-5 py-3 border-t border-white/5">
          <p className="text-[10px] text-gray-600 text-center">
            Powered by Claude Sonnet 4.6
          </p>
        </div>
      </aside>

      {/* ── Right panel: Chat interface (70%) ─────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-dark-900">
        {/* Chat header */}
        <div className="px-6 py-4 border-b border-white/5 bg-dark-800 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Asistente IA de Auditoría</h2>
            <p className="text-[11px] text-gray-500">
              Conversá con IA sobre los datos de tu negocio
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-green-400 font-medium">En línea</span>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {loading && <LoadingBubble />}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-6 py-4 border-t border-white/5 bg-dark-800 shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Preguntá sobre tus datos..."
              rows={2}
              className="flex-1 bg-dark-700 border border-white/10 text-white text-sm rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-accent/50 placeholder-gray-600 transition-colors disabled:opacity-50 leading-relaxed"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="w-10 h-10 bg-accent hover:bg-accent/80 text-white rounded-xl flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-600 mt-2 text-center">
            Enter o Ctrl+Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      </div>
    </div>
  )
}
