import { useState, useEffect } from 'react'

const STORAGE_KEY = 'watchlist'
const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA']

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : DEFAULT_WATCHLIST
    } catch {
      return DEFAULT_WATCHLIST
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist))
    } catch {}
  }, [watchlist])

  const addSymbol = (symbol) => {
    const s = symbol.toUpperCase().trim()
    if (s && !watchlist.includes(s)) {
      setWatchlist(prev => [...prev, s])
    }
  }

  const removeSymbol = (symbol) => {
    setWatchlist(prev => prev.filter(s => s !== symbol))
  }

  const isInWatchlist = (symbol) => watchlist.includes(symbol)

  return { watchlist, addSymbol, removeSymbol, isInWatchlist }
}
