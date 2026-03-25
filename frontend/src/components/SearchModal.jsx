import { useState, useEffect, useRef } from 'react'
import { fetchSP500 } from '../api'

export default function SearchModal({ onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    fetchSP500()
      .then(d => { setStocks(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const filtered = query.trim()
    ? stocks.filter(s =>
        s.symbol.toLowerCase().includes(query.toLowerCase()) ||
        s.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 50)
    : stocks.slice(0, 50)

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-panel border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search symbol or company name…"
            className="flex-1 bg-transparent text-primary placeholder-secondary outline-none text-sm"
          />
          <button onClick={onClose} className="text-secondary hover:text-primary text-xs px-2 py-1 rounded border border-border">
            Esc
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center text-secondary text-sm py-8">No results found</div>
          )}
          {!loading && filtered.map(s => (
            <button
              key={s.symbol}
              onClick={() => onSelect(s.symbol)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg transition-colors text-left"
            >
              <span className="text-accent font-bold text-sm w-16 shrink-0">{s.symbol}</span>
              <span className="text-primary text-sm truncate">{s.name}</span>
              <span className="text-secondary text-xs ml-auto shrink-0">{s.sector}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
