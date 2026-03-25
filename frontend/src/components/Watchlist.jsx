import { useState, useEffect, useCallback } from 'react'
import { fetchStockInfo, fetchSP500 } from '../api'

function WatchlistItem({ symbol, isSelected, onSelect, onRemove }) {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetchStockInfo(symbol)
        .then(d => { if (!cancelled) setInfo(d) })
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [symbol])

  const isGain = info?.change_pct >= 0

  return (
    <div
      onClick={() => onSelect(symbol)}
      className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors group
        ${isSelected ? 'bg-accent/10 border-l-2 border-accent' : 'hover:bg-bg border-l-2 border-transparent'}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-primary font-bold text-sm">{symbol}</span>
          {info?.price != null && (
            <span className="text-primary text-xs font-medium">${info.price.toFixed(2)}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-secondary text-xs truncate">{info?.name || '…'}</span>
          {info?.change_pct != null && (
            <span className={`text-xs font-semibold shrink-0 ${isGain ? 'text-gain' : 'text-loss'}`}>
              {isGain ? '+' : ''}{info.change_pct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(symbol) }}
        className="opacity-0 group-hover:opacity-100 text-secondary hover:text-loss transition-all p-0.5 shrink-0"
        title="Remove"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

export default function Watchlist({ watchlist, selectedSymbol, onSelect, onRemove, onAdd }) {
  const [addMode, setAddMode] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [sp500, setSP500] = useState([])

  useEffect(() => {
    fetchSP500().then(d => setSP500(d)).catch(() => {})
  }, [])

  const suggestions = addQuery.trim()
    ? sp500.filter(s =>
        !watchlist.includes(s.symbol) && (
          s.symbol.toLowerCase().includes(addQuery.toLowerCase()) ||
          s.name.toLowerCase().includes(addQuery.toLowerCase())
        )
      ).slice(0, 8)
    : []

  const handleAdd = (symbol) => {
    onAdd(symbol)
    setAddQuery('')
    setAddMode(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border shrink-0">
        <h2 className="text-xs font-semibold text-secondary uppercase tracking-wider">Watchlist</h2>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {watchlist.length === 0 && (
          <div className="text-center text-secondary text-xs py-6">Your watchlist is empty</div>
        )}
        {watchlist.map(symbol => (
          <WatchlistItem
            key={symbol}
            symbol={symbol}
            isSelected={symbol === selectedSymbol}
            onSelect={onSelect}
            onRemove={onRemove}
          />
        ))}
      </div>

      {/* Add symbol */}
      <div className="shrink-0 border-t border-border p-3">
        {addMode ? (
          <div className="relative">
            <input
              autoFocus
              type="text"
              value={addQuery}
              onChange={e => setAddQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setAddMode(false); setAddQuery('') }
                if (e.key === 'Enter' && suggestions.length > 0) handleAdd(suggestions[0].symbol)
              }}
              placeholder="Symbol or name…"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-primary text-xs
                placeholder-secondary outline-none focus:border-accent"
            />
            {suggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-panel border border-border rounded-lg overflow-hidden shadow-xl z-10">
                {suggestions.map(s => (
                  <button
                    key={s.symbol}
                    onClick={() => handleAdd(s.symbol)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg transition-colors text-left"
                  >
                    <span className="text-accent font-bold text-xs w-14 shrink-0">{s.symbol}</span>
                    <span className="text-primary text-xs truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setAddMode(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-secondary
              hover:text-accent border border-dashed border-border hover:border-accent/50 rounded-lg transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
            </svg>
            Add Symbol
          </button>
        )}
      </div>
    </div>
  )
}
