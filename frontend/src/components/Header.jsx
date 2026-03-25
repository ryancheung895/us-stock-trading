import { useState } from 'react'
import SearchModal from './SearchModal'

export default function Header({ selectedSymbol, stockInfo, onSelectSymbol }) {
  const [searchOpen, setSearchOpen] = useState(false)

  const isGain = stockInfo?.change_pct >= 0

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-panel border-b border-border flex items-center px-4 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#388bfd" strokeWidth="2.5">
            <polyline points="3,17 8,12 12,15 16,8 21,11" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-primary font-bold text-base tracking-tight hidden sm:block">StockScope</span>
        </div>

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 bg-bg border border-border rounded-lg px-3 py-2 text-secondary text-sm
            hover:border-accent/50 hover:text-primary transition-colors flex-1 max-w-xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <span>Search S&amp;P 500…</span>
          <kbd className="ml-auto text-xs bg-border px-1.5 py-0.5 rounded hidden sm:block">/</kbd>
        </button>

        {/* Current symbol chip */}
        {selectedSymbol && (
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <span className="text-primary font-bold text-sm">{selectedSymbol}</span>
            {stockInfo?.price != null && (
              <span className="text-primary text-sm">${stockInfo.price.toFixed(2)}</span>
            )}
            {stockInfo?.change_pct != null && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                isGain ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
              }`}>
                {isGain ? '+' : ''}{stockInfo.change_pct.toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </header>

      {searchOpen && (
        <SearchModal
          onSelect={(sym) => { onSelectSymbol(sym); setSearchOpen(false) }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </>
  )
}
