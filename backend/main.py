from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import pandas_ta as ta
from datetime import datetime, timedelta
from typing import Optional
import math

app = FastAPI(title="StockScope API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Module-level caches ──────────────────────────────────────────────────────
_sp500_cache: dict = {}          # {'data': [...], 'fetched_at': datetime}
_history_cache: dict = {}        # {key: {'data': [...], 'fetched_at': datetime}}


def _safe_float(val) -> Optional[float]:
    """Return None for NaN/Inf values."""
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return None


# ── SP500 ────────────────────────────────────────────────────────────────────
def _fetch_sp500_data() -> list[dict]:
    df = pd.read_html(
        "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
        header=0,
    )[0]
    df = df.rename(columns={
        "Symbol": "symbol",
        "Security": "name",
        "GICS Sector": "sector",
    })
    df["symbol"] = df["symbol"].str.replace(".", "-", regex=False)
    records = df[["symbol", "name", "sector"]].to_dict(orient="records")
    return records


@app.get("/api/sp500")
def get_sp500():
    try:
        now = datetime.utcnow()
        if _sp500_cache and (now - _sp500_cache["fetched_at"]) < timedelta(hours=1):
            return _sp500_cache["data"]
        data = _fetch_sp500_data()
        _sp500_cache["data"] = data
        _sp500_cache["fetched_at"] = now
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Stock info ───────────────────────────────────────────────────────────────
@app.get("/api/stock/{symbol}")
def get_stock_info(symbol: str):
    try:
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info
        hist = ticker.history(period="2d", interval="1d")
        price = None
        change = None
        change_pct = None
        if not hist.empty and len(hist) >= 1:
            price = _safe_float(hist["Close"].iloc[-1])
            if len(hist) >= 2:
                prev = _safe_float(hist["Close"].iloc[-2])
                if price is not None and prev is not None and prev != 0:
                    change = round(price - prev, 4)
                    change_pct = round((price - prev) / prev * 100, 4)
        return {
            "symbol": symbol.upper(),
            "name": info.get("longName") or info.get("shortName", symbol.upper()),
            "sector": info.get("sector", ""),
            "industry": info.get("industry", ""),
            "market_cap": _safe_float(info.get("marketCap")),
            "pe_ratio": _safe_float(info.get("trailingPE")),
            "week52_high": _safe_float(info.get("fiftyTwoWeekHigh")),
            "week52_low": _safe_float(info.get("fiftyTwoWeekLow")),
            "avg_volume": _safe_float(info.get("averageVolume")),
            "price": price,
            "change": change,
            "change_pct": change_pct,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── History ──────────────────────────────────────────────────────────────────
def _fetch_history(symbol: str, period: str, interval: str) -> list[dict]:
    ticker = yf.Ticker(symbol.upper())
    hist = ticker.history(period=period, interval=interval)
    if hist.empty:
        return []
    hist = hist.reset_index()
    time_col = "Datetime" if "Datetime" in hist.columns else "Date"
    rows = []
    for _, row in hist.iterrows():
        ts = row[time_col]
        if hasattr(ts, "timestamp"):
            t = int(ts.timestamp())
        else:
            t = int(pd.Timestamp(ts).timestamp())
        rows.append({
            "time": t,
            "open": _safe_float(row["Open"]),
            "high": _safe_float(row["High"]),
            "low": _safe_float(row["Low"]),
            "close": _safe_float(row["Close"]),
            "volume": _safe_float(row["Volume"]),
        })
    return rows


@app.get("/api/stock/{symbol}/history")
def get_history(
    symbol: str,
    period: str = Query(default="1y"),
    interval: str = Query(default="1d"),
):
    try:
        cache_key = f"{symbol.upper()}_{period}_{interval}"
        now = datetime.utcnow()
        if cache_key in _history_cache:
            entry = _history_cache[cache_key]
            if (now - entry["fetched_at"]) < timedelta(minutes=5):
                return entry["data"]
        data = _fetch_history(symbol, period, interval)
        _history_cache[cache_key] = {"data": data, "fetched_at": now}
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Indicators ───────────────────────────────────────────────────────────────
def _ts(val) -> Optional[int]:
    if val is None:
        return None
    try:
        if hasattr(val, "timestamp"):
            return int(val.timestamp())
        return int(pd.Timestamp(val).timestamp())
    except Exception:
        return None


@app.get("/api/stock/{symbol}/indicators")
def get_indicators(symbol: str, period: str = Query(default="1y")):
    try:
        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period=period, interval="1d")
        if hist.empty:
            raise HTTPException(status_code=404, detail="No data")

        hist = hist.reset_index()
        time_col = "Datetime" if "Datetime" in hist.columns else "Date"
        times = [_ts(t) for t in hist[time_col]]
        closes = hist["Close"].astype(float)

        def series_to_list(s, key="value"):
            result = []
            for i, (t, v) in enumerate(zip(times, s)):
                fv = _safe_float(v)
                if t is not None and fv is not None:
                    result.append({"time": t, key: fv})
            return result

        # SMA
        sma20 = ta.sma(closes, length=20)
        sma50 = ta.sma(closes, length=50)
        ema20 = ta.ema(closes, length=20)

        # Bollinger Bands
        bb = ta.bbands(closes, length=20, std=2)
        bb_upper = bb.iloc[:, 0] if bb is not None else pd.Series(dtype=float)
        bb_mid = bb.iloc[:, 1] if bb is not None else pd.Series(dtype=float)
        bb_lower = bb.iloc[:, 2] if bb is not None else pd.Series(dtype=float)

        # RSI
        rsi = ta.rsi(closes, length=14)

        # MACD
        macd_df = ta.macd(closes, fast=12, slow=26, signal=9)
        macd_line = macd_df.iloc[:, 0] if macd_df is not None else pd.Series(dtype=float)
        macd_signal = macd_df.iloc[:, 1] if macd_df is not None else pd.Series(dtype=float)
        macd_hist = macd_df.iloc[:, 2] if macd_df is not None else pd.Series(dtype=float)

        # BB as list of {time, upper, middle, lower}
        bb_list = []
        for i, t in enumerate(times):
            u = _safe_float(bb_upper.iloc[i]) if i < len(bb_upper) else None
            m = _safe_float(bb_mid.iloc[i]) if i < len(bb_mid) else None
            lo = _safe_float(bb_lower.iloc[i]) if i < len(bb_lower) else None
            if t is not None and u is not None:
                bb_list.append({"time": t, "upper": u, "middle": m, "lower": lo})

        # MACD as list of {time, macd, signal, histogram}
        macd_list = []
        for i, t in enumerate(times):
            mv = _safe_float(macd_line.iloc[i]) if i < len(macd_line) else None
            sv = _safe_float(macd_signal.iloc[i]) if i < len(macd_signal) else None
            hv = _safe_float(macd_hist.iloc[i]) if i < len(macd_hist) else None
            if t is not None and mv is not None:
                macd_list.append({"time": t, "macd": mv, "signal": sv, "histogram": hv})

        return {
            "sma20": series_to_list(sma20),
            "sma50": series_to_list(sma50),
            "ema20": series_to_list(ema20),
            "bb": bb_list,
            "rsi": series_to_list(rsi),
            "macd": macd_list,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Signals ──────────────────────────────────────────────────────────────────
@app.get("/api/stock/{symbol}/signals")
def get_signals(symbol: str):
    try:
        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period="1y", interval="1d")
        if hist.empty:
            raise HTTPException(status_code=404, detail="No data")

        hist = hist.reset_index()
        time_col = "Datetime" if "Datetime" in hist.columns else "Date"
        closes = hist["Close"].astype(float)
        times = list(hist[time_col])

        sma20 = ta.sma(closes, length=20)
        sma50 = ta.sma(closes, length=50)
        rsi = ta.rsi(closes, length=14)
        macd_df = ta.macd(closes, fast=12, slow=26, signal=9)
        macd_line = macd_df.iloc[:, 0] if macd_df is not None else pd.Series(dtype=float)
        macd_signal_line = macd_df.iloc[:, 1] if macd_df is not None else pd.Series(dtype=float)

        signals = []

        # SMA Crossover signals
        sma_signals = []
        for i in range(1, len(closes)):
            s20_prev = _safe_float(sma20.iloc[i - 1])
            s50_prev = _safe_float(sma50.iloc[i - 1])
            s20_curr = _safe_float(sma20.iloc[i])
            s50_curr = _safe_float(sma50.iloc[i])
            if None in (s20_prev, s50_prev, s20_curr, s50_curr):
                continue
            if s20_prev <= s50_prev and s20_curr > s50_curr:
                sma_signals.append({
                    "date": str(times[i])[:10],
                    "strategy": "SMA Crossover",
                    "action": "BUY",
                    "price": _safe_float(closes.iloc[i]),
                    "explanation": "SMA20 crossed above SMA50",
                })
            elif s20_prev >= s50_prev and s20_curr < s50_curr:
                sma_signals.append({
                    "date": str(times[i])[:10],
                    "strategy": "SMA Crossover",
                    "action": "SELL",
                    "price": _safe_float(closes.iloc[i]),
                    "explanation": "SMA20 crossed below SMA50",
                })
        signals.extend(sma_signals[-5:])

        # RSI signals
        rsi_signals = []
        for i in range(1, len(closes)):
            r_prev = _safe_float(rsi.iloc[i - 1])
            r_curr = _safe_float(rsi.iloc[i])
            if None in (r_prev, r_curr):
                continue
            if r_prev >= 30 and r_curr < 30:
                rsi_signals.append({
                    "date": str(times[i])[:10],
                    "strategy": "RSI",
                    "action": "BUY",
                    "price": _safe_float(closes.iloc[i]),
                    "explanation": f"RSI entered oversold territory ({r_curr:.1f})",
                })
            elif r_prev <= 70 and r_curr > 70:
                rsi_signals.append({
                    "date": str(times[i])[:10],
                    "strategy": "RSI",
                    "action": "SELL",
                    "price": _safe_float(closes.iloc[i]),
                    "explanation": f"RSI entered overbought territory ({r_curr:.1f})",
                })
        signals.extend(rsi_signals[-5:])

        # MACD crossover signals
        macd_signals = []
        for i in range(1, len(closes)):
            ml_prev = _safe_float(macd_line.iloc[i - 1])
            ms_prev = _safe_float(macd_signal_line.iloc[i - 1])
            ml_curr = _safe_float(macd_line.iloc[i])
            ms_curr = _safe_float(macd_signal_line.iloc[i])
            if None in (ml_prev, ms_prev, ml_curr, ms_curr):
                continue
            if ml_prev <= ms_prev and ml_curr > ms_curr:
                macd_signals.append({
                    "date": str(times[i])[:10],
                    "strategy": "MACD",
                    "action": "BUY",
                    "price": _safe_float(closes.iloc[i]),
                    "explanation": "MACD line crossed above signal line",
                })
            elif ml_prev >= ms_prev and ml_curr < ms_curr:
                macd_signals.append({
                    "date": str(times[i])[:10],
                    "strategy": "MACD",
                    "action": "SELL",
                    "price": _safe_float(closes.iloc[i]),
                    "explanation": "MACD line crossed below signal line",
                })
        signals.extend(macd_signals[-5:])

        # Latest indicator values
        latest_rsi = _safe_float(rsi.dropna().iloc[-1]) if not rsi.dropna().empty else None
        latest_sma20 = _safe_float(sma20.dropna().iloc[-1]) if not sma20.dropna().empty else None
        latest_sma50 = _safe_float(sma50.dropna().iloc[-1]) if not sma50.dropna().empty else None
        latest_macd = _safe_float(macd_line.dropna().iloc[-1]) if not macd_line.dropna().empty else None
        latest_signal_val = _safe_float(macd_signal_line.dropna().iloc[-1]) if not macd_signal_line.dropna().empty else None
        latest_price = _safe_float(closes.iloc[-1])

        # Determine current signal states
        sma_current = "NEUTRAL"
        if latest_sma20 and latest_sma50:
            sma_current = "BUY" if latest_sma20 > latest_sma50 else "SELL"

        rsi_current = "NEUTRAL"
        if latest_rsi:
            if latest_rsi < 30:
                rsi_current = "BUY"
            elif latest_rsi > 70:
                rsi_current = "SELL"

        macd_current = "NEUTRAL"
        if latest_macd and latest_signal_val:
            macd_current = "BUY" if latest_macd > latest_signal_val else "SELL"

        return {
            "symbol": symbol.upper(),
            "latest_price": latest_price,
            "summary": {
                "sma_crossover": {
                    "signal": sma_current,
                    "sma20": latest_sma20,
                    "sma50": latest_sma50,
                    "last_signal": sma_signals[-1] if sma_signals else None,
                },
                "rsi": {
                    "signal": rsi_current,
                    "value": latest_rsi,
                    "last_signal": rsi_signals[-1] if rsi_signals else None,
                },
                "macd": {
                    "signal": macd_current,
                    "macd_value": latest_macd,
                    "signal_value": latest_signal_val,
                    "last_signal": macd_signals[-1] if macd_signals else None,
                },
            },
            "recent_signals": sorted(signals, key=lambda x: x["date"], reverse=True)[:15],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Backtest ─────────────────────────────────────────────────────────────────
@app.get("/api/stock/{symbol}/backtest")
def get_backtest(
    symbol: str,
    strategy: str = Query(default="sma_crossover"),
    fast: int = Query(default=20),
    slow: int = Query(default=50),
    period: str = Query(default="2y"),
):
    try:
        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period=period, interval="1d")
        if hist.empty:
            raise HTTPException(status_code=404, detail="No data")

        hist = hist.reset_index()
        time_col = "Datetime" if "Datetime" in hist.columns else "Date"
        closes = hist["Close"].astype(float)
        times = list(hist[time_col])

        sma_fast = ta.sma(closes, length=fast)
        sma_slow = ta.sma(closes, length=slow)

        trades = []
        position = None  # {'price': ..., 'date': ...}
        equity = 1000.0
        peak_equity = equity
        max_drawdown = 0.0
        equity_curve = []

        for i in range(1, len(closes)):
            sf_prev = _safe_float(sma_fast.iloc[i - 1])
            ss_prev = _safe_float(sma_slow.iloc[i - 1])
            sf_curr = _safe_float(sma_fast.iloc[i])
            ss_curr = _safe_float(sma_slow.iloc[i])
            price = _safe_float(closes.iloc[i])
            date_str = str(times[i])[:10]
            ts = _ts(times[i])

            if None in (sf_prev, ss_prev, sf_curr, ss_curr, price):
                equity_curve.append({"time": ts, "value": round(equity, 2)})
                continue

            if sf_prev <= ss_prev and sf_curr > ss_curr:
                if position is None:
                    position = {"price": price, "date": date_str}
                    trades.append({
                        "date": date_str,
                        "action": "BUY",
                        "price": round(price, 4),
                        "pnl": None,
                    })
            elif sf_prev >= ss_prev and sf_curr < ss_curr:
                if position is not None:
                    pnl = (price - position["price"]) / position["price"] * equity
                    equity += pnl
                    trades.append({
                        "date": date_str,
                        "action": "SELL",
                        "price": round(price, 4),
                        "pnl": round(pnl, 4),
                    })
                    position = None

            current_equity = equity
            if position is not None and price and position["price"]:
                unrealized = (price - position["price"]) / position["price"] * equity
                current_equity = equity + unrealized

            if current_equity > peak_equity:
                peak_equity = current_equity
            drawdown = (peak_equity - current_equity) / peak_equity * 100
            if drawdown > max_drawdown:
                max_drawdown = drawdown

            equity_curve.append({"time": ts, "value": round(current_equity, 2)})

        if position is not None:
            last_price = _safe_float(closes.iloc[-1])
            if last_price:
                pnl = (last_price - position["price"]) / position["price"] * equity
                equity += pnl
                trades.append({
                    "date": str(times[-1])[:10],
                    "action": "SELL (close)",
                    "price": round(last_price, 4),
                    "pnl": round(pnl, 4),
                })

        total_return_pct = round((equity - 1000) / 1000 * 100, 2)
        completed = [t for t in trades if t.get("pnl") is not None]
        wins = [t for t in completed if t["pnl"] and t["pnl"] > 0]
        win_rate = round(len(wins) / len(completed) * 100, 1) if completed else 0.0

        return {
            "symbol": symbol.upper(),
            "strategy": strategy,
            "fast": fast,
            "slow": slow,
            "period": period,
            "total_return_pct": total_return_pct,
            "num_trades": len(completed),
            "win_rate": win_rate,
            "max_drawdown": round(max_drawdown, 2),
            "initial_equity": 1000.0,
            "final_equity": round(equity, 2),
            "trades": trades,
            "equity_curve": equity_curve,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
