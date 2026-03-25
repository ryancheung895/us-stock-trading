import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

export const fetchSP500 = () =>
  api.get('/sp500').then(r => r.data)

export const fetchStockInfo = (symbol) =>
  api.get(`/stock/${symbol}`).then(r => r.data)

export const fetchHistory = (symbol, period = '1y', interval = '1d') =>
  api.get(`/stock/${symbol}/history`, { params: { period, interval } }).then(r => r.data)

export const fetchIndicators = (symbol, period = '1y') =>
  api.get(`/stock/${symbol}/indicators`, { params: { period } }).then(r => r.data)

export const fetchSignals = (symbol) =>
  api.get(`/stock/${symbol}/signals`).then(r => r.data)

export const fetchBacktest = (symbol, strategy = 'sma_crossover', fast = 20, slow = 50, period = '2y') =>
  api.get(`/stock/${symbol}/backtest`, { params: { strategy, fast, slow, period } }).then(r => r.data)
