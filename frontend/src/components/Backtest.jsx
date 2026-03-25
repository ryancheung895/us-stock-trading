import { useState, useEffect, useRef } from 'react'
import { createChart } from 'lightweight-charts'
import { fetchBacktest } from '../api'

const CHART_OPTIONS = {
  layout: { background: { color: '#0d1117' }, textColor: '#8b949e' },
  grid: { vertLines: { color: '#21262d' }, horzLines: { color: '#21262d' } },
  rightPriceScale: { borderColor: '#21262d' },
  timeScale: { borderColor: '#21262d' },
}

function MetricCard({ label, value, positive }) {
  const color = positive === undefined
    ? 'text-primary'
    : positive ? 'text-gain' : 'text-loss'
  return (
    <div className="bg-bg border border-border rounded-xl p-4">
      <div className="text-secondary text-xs mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  )
}

export default function Backtest({ symbol }) {
  const [fast, setFast] = useState(20)
  const [slow, setSlow] = useState(50)
  const [period, setPeriod] = useState('2y')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const chartRef = useRef(null)
  const chartInstanceRef = useRef(null)

  const runBacktest = () => {
    setLoading(true)
    setError(null)
    fetchBacktest(symbol, 'sma_crossover', fast, slow, period)
      .then(d => { setResult(d); setLoading(false) })
      .catch(() => { setError('Backtest failed. Please try again.'); setLoading(false) })
  }

  // Equity curve chart
  useEffect(() => {
    if (!chartRef.current || !result?.equity_curve?.length) return

    if (chartInstanceRef.current) {
      try { chartInstanceRef.current.remove() } catch {}
      chartInstanceRef.current = null
    }

    const chart = createChart(chartRef.current, {
      ...CHART_OPTIONS,
      width: chartRef.current.clientWidth,
      height: 200,
    })
    chartInstanceRef.current = chart

    const lineSeries = chart.addLineSeries({
      color: result.total_return_pct >= 0 ? '#00c076' : '#ff3b30',
      lineWidth: 2,
    })
    lineSeries.setData(
      result.equity_curve.filter(d => d.time != null && d.value != null)
    )
    chart.timeScale().fitContent()

    const ro = new ResizeObserver(() => {
      if (chartRef.current && chartInstanceRef.current)
        chartInstanceRef.current.applyOptions({ width: chartRef.current.clientWidth })
    })
    ro.observe(chartRef.current)

    return () => {
      ro.disconnect()
      if (chartInstanceRef.current) {
        try { chartInstanceRef.current.remove() } catch {}
        chartInstanceRef.current = null
      }
    }
  }, [result])

  const formatPct = (n) => n != null ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : '—'

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider">{symbol} — Backtest</h2>

      {/* Config form */}
      <div className="bg-panel border border-border rounded-xl p-4">
        <h3 className="text-primary text-sm font-semibold mb-3">SMA Crossover Strategy</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-secondary mb-1">Strategy</label>
            <select
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-primary text-sm focus:border-accent outline-none"
              value="sma_crossover"
              readOnly
            >
              <option value="sma_crossover">SMA Crossover</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">Fast Period</label>
            <input
              type="number"
              value={fast}
              onChange={e => setFast(Math.max(2, parseInt(e.target.value) || 20))}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-primary text-sm focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">Slow Period</label>
            <input
              type="number"
              value={slow}
              onChange={e => setSlow(Math.max(2, parseInt(e.target.value) || 50))}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-primary text-sm focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">Period</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-primary text-sm focus:border-accent outline-none"
            >
              <option value="1y">1 Year</option>
              <option value="2y">2 Years</option>
              <option value="3y">3 Years</option>
              <option value="5y">5 Years</option>
            </select>
          </div>
        </div>
        <button
          onClick={runBacktest}
          disabled={loading}
          className="mt-4 w-full sm:w-auto px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold
            hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {loading ? 'Running…' : 'Run Backtest'}
        </button>
      </div>

      {error && (
        <div className="bg-loss/10 border border-loss/30 rounded-xl p-4 text-loss text-sm">{error}</div>
      )}

      {result && !loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Total Return" value={formatPct(result.total_return_pct)} positive={result.total_return_pct >= 0} />
            <MetricCard label="# Trades" value={result.num_trades ?? '—'} />
            <MetricCard label="Win Rate" value={result.win_rate != null ? `${result.win_rate.toFixed(1)}%` : '—'} positive={result.win_rate >= 50} />
            <MetricCard label="Max Drawdown" value={result.max_drawdown != null ? `-${result.max_drawdown.toFixed(2)}%` : '—'} positive={false} />
          </div>

          <div className="bg-panel border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider">Equity Curve (starting $1,000)</h3>
            </div>
            <div ref={chartRef} className="w-full" style={{ height: 200 }} />
          </div>

          {result.trades?.length > 0 && (
            <div className="bg-panel border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider">Trade Log</h3>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-panel">
                    <tr className="text-secondary border-b border-border">
                      <th className="text-left px-4 py-2">Date</th>
                      <th className="text-left px-4 py-2">Action</th>
                      <th className="text-right px-4 py-2">Price</th>
                      <th className="text-right px-4 py-2">P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-bg transition-colors">
                        <td className="px-4 py-2 text-secondary">{t.date}</td>
                        <td className={`px-4 py-2 font-semibold ${t.action.includes('BUY') ? 'text-gain' : 'text-loss'}`}>{t.action}</td>
                        <td className="px-4 py-2 text-right text-primary">${t.price?.toFixed(2) ?? '—'}</td>
                        <td className={`px-4 py-2 text-right font-medium ${
                          t.pnl == null ? 'text-secondary' : t.pnl >= 0 ? 'text-gain' : 'text-loss'
                        }`}>
                          {t.pnl == null ? '—' : `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
