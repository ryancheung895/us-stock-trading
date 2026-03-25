import { useState, useEffect } from 'react'
import { fetchSignals } from '../api'

function SignalBadge({ signal }) {
  const map = {
    BUY: 'bg-gain/10 text-gain border border-gain/30',
    SELL: 'bg-loss/10 text-loss border border-loss/30',
    NEUTRAL: 'bg-secondary/10 text-secondary border border-secondary/20',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[signal] || map.NEUTRAL}`}>
      {signal || 'NEUTRAL'}
    </span>
  )
}

function RSIGauge({ value }) {
  if (value == null) return <div className="text-secondary text-sm">—</div>
  const pct = Math.min(Math.max(value, 0), 100)
  const color = value > 70 ? '#ff3b30' : value < 30 ? '#00c076' : '#388bfd'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-primary font-semibold text-sm w-10">{value.toFixed(1)}</span>
    </div>
  )
}

export default function Signals({ symbol }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!symbol) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setData(null)
    fetchSignals(symbol)
      .then(d => { if (!controller.signal.aborted) { setData(d); setLoading(false) } })
      .catch(() => { if (!controller.signal.aborted) { setError('Failed to load signals'); setLoading(false) } })
    return () => controller.abort()
  }, [symbol])

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error) return <div className="p-6 text-center text-secondary text-sm">{error}</div>
  if (!data) return null

  const { summary, recent_signals } = data

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider">{symbol} — Strategy Signals</h2>

      <div className="grid grid-cols-1 gap-3">
        {/* SMA Crossover */}
        <div className="bg-panel border border-border rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-primary font-semibold text-sm">SMA Crossover</div>
              <div className="text-secondary text-xs mt-0.5">20-day / 50-day moving average</div>
            </div>
            <SignalBadge signal={summary?.sma_crossover?.signal} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-secondary mb-1">SMA 20</div>
              <div className="text-yellow-400 font-semibold">
                {summary?.sma_crossover?.sma20 != null ? `$${summary.sma_crossover.sma20.toFixed(2)}` : '—'}
              </div>
            </div>
            <div>
              <div className="text-secondary mb-1">SMA 50</div>
              <div className="text-purple-400 font-semibold">
                {summary?.sma_crossover?.sma50 != null ? `$${summary.sma_crossover.sma50.toFixed(2)}` : '—'}
              </div>
            </div>
          </div>
          {summary?.sma_crossover?.last_signal && (
            <div className="mt-3 pt-3 border-t border-border text-xs">
              <div className="text-secondary">Last signal</div>
              <div className="text-primary mt-0.5">
                {summary.sma_crossover.last_signal.date} — {summary.sma_crossover.last_signal.explanation}
              </div>
            </div>
          )}
        </div>

        {/* RSI */}
        <div className="bg-panel border border-border rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-primary font-semibold text-sm">RSI (14)</div>
              <div className="text-secondary text-xs mt-0.5">Relative Strength Index</div>
            </div>
            <SignalBadge signal={summary?.rsi?.signal} />
          </div>
          <RSIGauge value={summary?.rsi?.value} />
          <div className="flex justify-between text-xs text-secondary mt-1">
            <span className="text-gain">Oversold &lt;30</span>
            <span>Neutral</span>
            <span className="text-loss">Overbought &gt;70</span>
          </div>
          {summary?.rsi?.last_signal && (
            <div className="mt-3 pt-3 border-t border-border text-xs">
              <div className="text-secondary">Last signal</div>
              <div className="text-primary mt-0.5">
                {summary.rsi.last_signal.date} — {summary.rsi.last_signal.explanation}
              </div>
            </div>
          )}
        </div>

        {/* MACD */}
        <div className="bg-panel border border-border rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-primary font-semibold text-sm">MACD (12,26,9)</div>
              <div className="text-secondary text-xs mt-0.5">Moving Average Convergence Divergence</div>
            </div>
            <SignalBadge signal={summary?.macd?.signal} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-secondary mb-1">MACD Line</div>
              <div className="text-accent font-semibold">
                {summary?.macd?.macd_value != null ? summary.macd.macd_value.toFixed(4) : '—'}
              </div>
            </div>
            <div>
              <div className="text-secondary mb-1">Signal Line</div>
              <div className="text-loss font-semibold">
                {summary?.macd?.signal_value != null ? summary.macd.signal_value.toFixed(4) : '—'}
              </div>
            </div>
          </div>
          {summary?.macd?.last_signal && (
            <div className="mt-3 pt-3 border-t border-border text-xs">
              <div className="text-secondary">Last signal</div>
              <div className="text-primary mt-0.5">
                {summary.macd.last_signal.date} — {summary.macd.last_signal.explanation}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent signals table */}
      {recent_signals?.length > 0 && (
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider">Recent Signals</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-secondary border-b border-border">
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Strategy</th>
                  <th className="text-left px-4 py-2">Action</th>
                  <th className="text-right px-4 py-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {recent_signals.map((s, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-bg transition-colors">
                    <td className="px-4 py-2 text-secondary">{s.date}</td>
                    <td className="px-4 py-2 text-primary">{s.strategy}</td>
                    <td className="px-4 py-2">
                      <span className={`font-semibold ${s.action === 'BUY' ? 'text-gain' : 'text-loss'}`}>{s.action}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-primary">${s.price?.toFixed(2) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
