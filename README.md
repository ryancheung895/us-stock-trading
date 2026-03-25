# StockScope — US Stock Analysis MVP

Mobile-first interactive stock analysis web app for S&P 500 stocks.

## Features
- 📊 Interactive candlestick charts with technical indicators (SMA, EMA, Bollinger Bands, RSI, MACD)
- 📋 Watchlist management (persisted locally)
- 🔔 Strategy signals (SMA crossover, RSI, MACD)
- 🧪 Single-symbol backtesting (SMA crossover strategy)
- 🔍 S&P 500 stock search

## Tech Stack
- **Backend**: Python 3.10+, FastAPI, yfinance, pandas, pandas-ta
- **Frontend**: React 18, Vite, lightweight-charts, Tailwind CSS

## Setup & Run

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173
