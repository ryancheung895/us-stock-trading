import { useEffect, useRef, useState } from 'react'
import { createChart } from 'lightweight-charts'
import { fetchHistory, fetchIndicators, fetchStockInfo } from '../api'

const PERIODS = ['1D', '5D', '1M', '3M', '6M', '1Y', '2Y']
const PERIOD_MAP = {
  '1D': { period: '1d', interval: '5m' },
  '5D': { period: '5d', interval: '15m' },
  '1M': { period: '1mo', interval: '1d' },
  '3M': { period: '3mo', interval: '1d' },
  '6M': { period: '6mo', interval: '1d' },
  '1Y': { period: '1y', interval: '1d' },
  '2Y': { period: '2y', interval: '1d' },
}

const CHART_OPTIONS = {
  layout: { background: { color: '#0d1117' }, textColor: '#8b949e' },
  grid: { vertLines: { color: '#21262d' }, horzLines: { color: '#21262d' } },
  crosshair: { mode: 1 },
  rightPriceScale: { borderColor: '#21262d' },
  timeScale: { borderColor: '#21262d', timeVisible: true },
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function formatLargeNum(n) {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

export default function StockChart({ symbol }) {
  const [activePeriod, setActivePeriod] = useState('1Y')
  const [chartType, setChartType] = useState('candlestick')
  const [indicators, setIndicators] = useState({ sma20: false, sma50: false, ema20: false, bb: false, volume: true })
  const [oscillator, setOscillator] = useState('none') // 'none'|'rsi'|'macd'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [histData, setHistData] = useState([])
  const [indData, setIndData] = useState(null)

  const mainRef = useRef(null)
  const oscRef = useRef(null)
  const chartsRef = useRef({ main: null, osc: null })

  // Fetch data when symbol or period changes
  useEffect(() => {
    if (!symbol) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const { period, interval } = PERIOD_MAP[activePeriod]
    const needsIndicators = ['1M', '3M', '6M', '1Y', '2Y'].includes(activePeriod)

    Promise.all([
      fetchHistory(symbol, period, interval),
      needsIndicators ? fetchIndicators(symbol, period) : Promise.resolve(null),
      fetchStockInfo(symbol),
    ])
      .then(([hist, ind, inf]) => {
        if (!controller.signal.aborted) {
          setHistData(hist || [])
          setIndData(ind)
          setInfo(inf)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Failed to load chart data')
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [symbol, activePeriod])

  // Build/update charts when data or options change
  useEffect(() => {
    if (!mainRef.current || histData.length === 0) return

    // Destroy old charts
    if (chartsRef.current.main) { try { chartsRef.current.main.remove() } catch {} chartsRef.current.main = null }
    if (chartsRef.current.osc) { try { chartsRef.current.osc.remove() } catch {} chartsRef.current.osc = null }

    // Main chart
    const mainChart = createChart(mainRef.current, {
      ...CHART_OPTIONS,
      width: mainRef.current.clientWidth,
      height: mainRef.current.clientHeight,
    })
    chartsRef.current.main = mainChart

    // Price series
    if (chartType === 'candlestick') {
      const cs = mainChart.addCandlestickSeries({
        upColor: '#00c076', downColor: '#ff3b30',
        borderUpColor: '#00c076', borderDownColor: '#ff3b30',
        wickUpColor: '#00c076', wickDownColor: '#ff3b30',
      })
      cs.setData(histData.filter(d =>
        d.time != null && d.open != null && d.high != null && d.low != null && d.close != null
      ))
    } else {
      const ls = mainChart.addLineSeries({ color: '#388bfd', lineWidth: 2 })
      ls.setData(histData.filter(d => d.time != null && d.close != null).map(d => ({ time: d.time, value: d.close })))
    }

    // Volume
    if (indicators.volume) {
      const volSeries = mainChart.addHistogramSeries({
        color: '#388bfd44', priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      mainChart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      volSeries.setData(histData.filter(d => d.time != null && d.volume != null).map(d => ({
        time: d.time, value: d.volume,
        color: d.close >= d.open ? '#00c07633' : '#ff3b3033',
      })))
    }

    // Indicator overlays
    if (indData) {
      if (indicators.sma20 && indData.sma20?.length) {
        const s = mainChart.addLineSeries({ color: '#f0b429', lineWidth: 1, title: 'SMA20' })
        s.setData(indData.sma20)
      }
      if (indicators.sma50 && indData.sma50?.length) {
        const s = mainChart.addLineSeries({ color: '#e879f9', lineWidth: 1, title: 'SMA50' })
        s.setData(indData.sma50)
      }
      if (indicators.ema20 && indData.ema20?.length) {
        const s = mainChart.addLineSeries({ color: '#06b6d4', lineWidth: 1, title: 'EMA20' })
        s.setData(indData.ema20)
      }
      if (indicators.bb && indData.bb?.length) {
        const upper = mainChart.addLineSeries({ color: '#8b949e', lineWidth: 1, lineStyle: 2, title: 'BB Upper' })
        const mid = mainChart.addLineSeries({ color: '#8b949e55', lineWidth: 1, lineStyle: 2, title: 'BB Mid' })
        const lower = mainChart.addLineSeries({ color: '#8b949e', lineWidth: 1, lineStyle: 2, title: 'BB Lower' })
        upper.setData(indData.bb.map(d => ({ time: d.time, value: d.upper })))
        mid.setData(indData.bb.map(d => ({ time: d.time, value: d.middle })))
        lower.setData(indData.bb.map(d => ({ time: d.time, value: d.lower })))
      }
    }

    mainChart.timeScale().fitContent()

    // Oscillator pane (second chart instance, synced time scale)
    if (oscillator !== 'none' && oscRef.current && indData) {
      const oscChart = createChart(oscRef.current, {
        ...CHART_OPTIONS,
        width: oscRef.current.clientWidth,
        height: oscRef.current.clientHeight,
      })
      chartsRef.current.osc = oscChart

      mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) oscChart.timeScale().setVisibleLogicalRange(range)
      })
      oscChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) mainChart.timeScale().setVisibleLogicalRange(range)
      })

      if (oscillator === 'rsi' && indData.rsi?.length) {
        const rsiSeries = oscChart.addLineSeries({ color: '#f0b429', lineWidth: 2, title: 'RSI' })
        rsiSeries.setData(indData.rsi)
        rsiSeries.createPriceLine({ price: 70, color: '#ff3b30', lineWidth: 1, lineStyle: 2, title: '70' })
        rsiSeries.createPriceLine({ price: 30, color: '#00c076', lineWidth: 1, lineStyle: 2, title: '30' })
      }

      if (oscillator === 'macd' && indData.macd?.length) {
        const macdLine = oscChart.addLineSeries({ color: '#388bfd', lineWidth: 2, title: 'MACD' })
        const signalLine = oscChart.addLineSeries({ color: '#ff3b30', lineWidth: 1, title: 'Signal' })
        const histSeries = oscChart.addHistogramSeries({ color: '#00c07666', title: 'Histogram' })
        macdLine.setData(indData.macd.map(d => ({ time: d.time, value: d.macd })))
        signalLine.setData(indData.macd.filter(d => d.signal != null).map(d => ({ time: d.time, value: d.signal })))
        histSeries.setData(indData.macd.filter(d => d.histogram != null).map(d => ({
          time: d.time, value: d.histogram,
          color: d.histogram >= 0 ? '#00c07666' : '#ff3b3066',
        })))
      }

      oscChart.timeScale().fitContent()
    }

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (mainRef.current && chartsRef.current.main)
        chartsRef.current.main.applyOptions({ width: mainRef.current.clientWidth })
      if (oscRef.current && chartsRef.current.osc)
        chartsRef.current.osc.applyOptions({ width: oscRef.current.clientWidth })
    })
    if (mainRef.current) ro.observe(mainRef.current)
    if (oscRef.current) ro.observe(oscRef.current)

    return () => {
      ro.disconnect()
      if (chartsRef.current.main) { try { chartsRef.current.main.remove() } catch {} chartsRef.current.main = null }
      if (chartsRef.current.osc) { try { chartsRef.current.osc.remove() } catch {} chartsRef.current.osc = null }
    }
  }, [histData, indData, chartType, indicators, oscillator])

  const toggleIndicator = (key) => setIndicators(prev => ({ ...prev, [key]: !prev[key] }))
  const isGain = info?.change_pct >= 0

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 border-b border-border text-xs">
        <div className="flex items-baseline gap-2">
          <span className="text-primary font-bold text-base">{symbol}</span>
          {info?.price != null && (
            <span className="text-primary font-semibold">${info.price.toFixed(2)}</span>
          )}
          {info?.change != null && (
            <span className={isGain ? 'text-gain' : 'text-loss'}>
              {isGain ? '+' : ''}{info.change.toFixed(2)} ({isGain ? '+' : ''}{info.change_pct?.toFixed(2)}%)
            </span>
          )}
        </div>
        <div className="flex gap-4 text-secondary flex-wrap">
          {info?.market_cap != null && <span>Mkt Cap: <span className="text-primary">{formatLargeNum(info.market_cap)}</span></span>}
          {info?.pe_ratio != null && <span>P/E: <span className="text-primary">{info.pe_ratio.toFixed(1)}</span></span>}
          {info?.week52_high != null && <span>52W H: <span className="text-primary">${info.week52_high.toFixed(2)}</span></span>}
          {info?.week52_low != null && <span>52W L: <span className="text-primary">${info.week52_low.toFixed(2)}</span></span>}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border">
        {/* Period */}
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className={`px-2 py-1 text-xs rounded font-medium transition-colors
                ${activePeriod === p ? 'bg-accent text-white' : 'text-secondary hover:text-primary hover:bg-border'}`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-border hidden sm:block" />
        {/* Chart type */}
        {['candlestick', 'line'].map(t => (
          <button
            key={t}
            onClick={() => setChartType(t)}
            className={`px-2 py-1 text-xs rounded capitalize transition-colors
              ${chartType === t ? 'bg-panel border border-accent/50 text-accent' : 'text-secondary hover:text-primary'}`}
          >
            {t}
          </button>
        ))}
        <div className="w-px h-4 bg-border hidden sm:block" />
        {/* Indicators */}
        {[
          { key: 'sma20', label: 'SMA20', color: 'text-yellow-400' },
          { key: 'sma50', label: 'SMA50', color: 'text-purple-400' },
          { key: 'ema20', label: 'EMA20', color: 'text-cyan-400' },
          { key: 'bb', label: 'BB', color: 'text-secondary' },
          { key: 'volume', label: 'Vol', color: 'text-blue-400' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggleIndicator(key)}
            className={`px-2 py-1 text-xs rounded transition-colors
              ${indicators[key] ? `${color} bg-panel border border-border` : 'text-secondary/50 hover:text-secondary'}`}
          >
            {label}
          </button>
        ))}
        <div className="w-px h-4 bg-border hidden sm:block" />
        {/* Oscillator */}
        {['none', 'rsi', 'macd'].map(o => (
          <button
            key={o}
            onClick={() => setOscillator(o)}
            className={`px-2 py-1 text-xs rounded uppercase transition-colors
              ${oscillator === o ? 'bg-panel border border-accent/50 text-accent' : 'text-secondary hover:text-primary'}`}
          >
            {o === 'none' ? 'Osc Off' : o.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Chart area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/80">
            <Spinner />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-secondary text-sm">{error}</div>
        )}
        <div
          ref={mainRef}
          className="flex-1 min-h-0"
          style={{ height: oscillator !== 'none' ? 'calc(100% - 140px)' : '100%' }}
        />
        {oscillator !== 'none' && (
          <div ref={oscRef} className="border-t border-border" style={{ height: '140px' }} />
        )}
      </div>
    </div>
  )
}
