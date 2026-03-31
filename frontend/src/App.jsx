import { useState, useEffect } from 'react'
import { useWatchlist } from './hooks/useWatchlist'
import { fetchStockInfo } from './api'
import Header from './components/Header'
import Watchlist from './components/Watchlist'
import StockChart from './components/StockChart'
import Signals from './components/Signals'
import Backtest from './components/Backtest'
import News from './components/News'

const NAV_TABS = [
  {
    id: 'chart', label: 'Chart',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3,17 8,12 12,15 16,8 21,11" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'news', label: 'News',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2Z" strokeLinecap="round"/>
        <path d="M18 14H8M18 10H8M12 6H8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'signals', label: 'Signals',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'backtest', label: 'Backtest',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15,15" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
  const [activeTab, setActiveTab] = useState('chart')
  const [stockInfo, setStockInfo] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { watchlist, addSymbol, removeSymbol, isInWatchlist } = useWatchlist()

  useEffect(() => {
    if (!selectedSymbol) return
    let cancelled = false
    fetchStockInfo(selectedSymbol)
      .then(d => { if (!cancelled) setStockInfo(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedSymbol])

  const handleSelectSymbol = (sym) => {
    setSelectedSymbol(sym)
    setActiveTab('chart')
  }

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      <Header
        selectedSymbol={selectedSymbol}
        stockInfo={stockInfo}
        onSelectSymbol={handleSelectSymbol}
      />

      <div className="flex flex-1 min-h-0 mt-16">
        {/* Sidebar — desktop only, collapsible */}
        <aside
          className={`shrink-0 border-r border-border bg-panel flex-col transition-all duration-200
            hidden md:flex ${sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`}
          style={{ minHeight: 0 }}
        >
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <Watchlist
              watchlist={watchlist}
              selectedSymbol={selectedSymbol}
              onSelect={handleSelectSymbol}
              onRemove={removeSymbol}
              onAdd={addSymbol}
            />
          </div>
        </aside>

        {/* Sidebar toggle — desktop only */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="hidden md:flex items-center justify-center w-4 shrink-0 bg-border/30 hover:bg-border/60 transition-colors z-10"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <span className="text-secondary text-xs">{sidebarOpen ? '‹' : '›'}</span>
        </button>

        {/* Main content */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Desktop tab bar */}
          <div className="hidden md:flex border-b border-border shrink-0">
            {NAV_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2
                  ${activeTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-secondary hover:text-primary'}`}
              >
                {tab.label}
              </button>
            ))}
            <div className="ml-auto flex items-center pr-4">
              <button
                onClick={() => isInWatchlist(selectedSymbol) ? removeSymbol(selectedSymbol) : addSymbol(selectedSymbol)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${isInWatchlist(selectedSymbol)
                    ? 'bg-accent/10 text-accent border border-accent/30'
                    : 'text-secondary border border-border hover:border-accent/50 hover:text-accent'}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24"
                  fill={isInWatchlist(selectedSymbol) ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="2"
                >
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                </svg>
                {isInWatchlist(selectedSymbol) ? 'Watchlisted' : 'Add to Watchlist'}
              </button>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 min-h-0 overflow-y-auto pb-16 md:pb-0">
            {activeTab === 'chart' && (
              <div className="h-full flex flex-col" style={{ minHeight: '500px' }}>
                <StockChart symbol={selectedSymbol} />
              </div>
            )}
            {activeTab === 'news' && <News symbol={selectedSymbol} />}
            {activeTab === 'signals' && <Signals symbol={selectedSymbol} />}
            {activeTab === 'backtest' && <Backtest symbol={selectedSymbol} />}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-panel border-t border-border z-40 flex">
        {NAV_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors
              ${activeTab === tab.id ? 'text-accent' : 'text-secondary'}`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
