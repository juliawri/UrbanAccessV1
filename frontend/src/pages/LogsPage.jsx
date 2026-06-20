import { useEffect, useRef, useState } from 'react'
import Navbar from '../components/Navbar'

function classifyLine(text) {
  const t = text.toLowerCase()
  if (t.includes('error') || t.includes('exception') || t.includes('traceback')) return 'error'
  if (t.includes('warning') || t.includes('warn')) return 'warn'
  if (/\[(faiss|auth|process|delete_account|otp|routing|pipeline|llm)\]/.test(t)) return 'tag'
  if (/\[(mapillary|gemini|vit)\]/.test(t) || t.includes('=== system prompt') || t.includes('=== user prompt') || t.includes('=== gemini')) return 'ml'
  return 'normal'
}

const LINE_COLORS = {
  error:  '#ff8080',
  warn:   '#ffc878',
  tag:    '#FE8E3C',
  ml:     '#6ec6e0',
  normal: '#ffffff',
}

const LEGEND = [
  ['error',  'Error'],
  ['warn',   'Warning'],
  ['tag',    'System tag'],
  ['ml',     'ML / Vision / Prompts'],
  ['normal', 'Info'],
]

function Cursor() {
  return (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 13,
      background: '#2d5a5a',
      verticalAlign: 'middle',
      marginLeft: 4,
      animation: 'blink 1s step-end infinite',
    }} />
  )
}

export default function LogsPage() {
  const [lines, setLines]       = useState([])
  const [connected, setConnected] = useState(false)
  const [session, setSession]   = useState(0)
  const bottomRef = useRef(null)

  useEffect(() => {
    const es = new EventSource('/api/logs')
    es.onopen  = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (e) => {
      if (e.data === '__RESET__') {
        setLines([])
        setSession(s => s + 1)
        return
      }
      if (!e.data.trim()) return
      const type = classifyLine(e.data)
      setLines(prev => [...prev, { text: e.data, type }])
    }
    return () => es.close()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <Navbar />

      <div style={{ padding: '32px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          fontSize: 'clamp(42px, 6vw, 72px)',
          color: '#d4722a',
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: '6px',
          textAlign: 'center',
          margin: '0 0 8px',
        }}>
          URBAN ACCESS
        </h1>
        <p style={{
          textAlign: 'center',
          color: '#1e3d3d',
          fontSize: 18,
          fontWeight: 600,
          margin: '0 0 32px',
        }}>
          Route Processing Logs
        </p>

        {/* Status row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: connected ? '#22c55e' : '#ef4444',
              boxShadow: connected ? '0 0 6px #22c55e88' : 'none',
              transition: 'background 0.3s',
            }} />
            <span style={{ fontSize: 12, color: connected ? '#22c55e' : '#ef4444', fontFamily: 'monospace' }}>
              {connected ? 'live' : 'disconnected'}
            </span>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>
            {lines.length} line{lines.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Terminal window */}
        <div style={{
          borderRadius: 10,
          overflow: 'hidden',
          border: '1.5px solid #1e3d3d',
          boxShadow: '0 4px 32px rgba(0,0,0,0.22)',
          fontFamily: '"Cascadia Code","Fira Code","JetBrains Mono","Courier New",monospace',
        }}>
          {/* Title bar */}
          <div style={{
            background: '#1e3d3d',
            padding: '9px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
            <span style={{ marginLeft: 10, color: '#FE8E3C', fontSize: 12, letterSpacing: '0.03em', fontFamily: "'Open Sans', sans-serif" }}>
              urban-access — uvicorn logs
            </span>
          </div>

          {/* Log body */}
          <div style={{
            background: '#0d1f1f',
            padding: '14px 18px',
            minHeight: 320,
            maxHeight: 560,
            overflowY: 'auto',
            fontFamily: "'Open Sans', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.75,
          }}>
            {lines.length === 0 ? (
              <div style={{ color: '#2d5a5a', fontStyle: 'italic', fontSize: 12 }}>
                Waiting for a route to be planned…<Cursor />
              </div>
            ) : (
              lines.map((line, i) => (
                <div
                  key={`${session}-${i}`}
                  style={{ display: 'flex', gap: 12, wordBreak: 'break-all' }}
                >
                  <span style={{
                    color: '#7aafaf',
                    fontSize: 13,
                    fontWeight: 400,
                    userSelect: 'none',
                    flexShrink: 0,
                    minWidth: 32,
                    textAlign: 'right',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ color: LINE_COLORS[line.type] }}>
                    {line.text}
                  </span>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
          {LEGEND.map(([k, label]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: LINE_COLORS[k] }} />
              <span style={{ fontSize: 11, color: '#6b7280' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap');
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  )
}
