# trading-ai-platform

News, economic-calendar, and technical-bias dashboard for futures and macro markets.

## Backend

```bash
cd backend
npm install
node server.js
```

The backend runs on `http://localhost:5000`.

SQLite runtime data is stored at `backend/data/trading_ai.db`. The repository tracks
`backend/data/.gitkeep` so the data directory exists after a fresh clone, but the
actual `.db` files are generated locally and ignored by Git.

Expected Move is a market-derived 14-session Average True Range (ATR) for the next
trading session. It is calculated from Yahoo Finance daily OHLC candles, not from a
fixed percentage of price or a bias-score multiplier. If historical candles are
unavailable, the expected-move value is reported as unavailable and the saved audit
context records why.

Market-structure analysis adds two deterministic inputs:

- CVD uses cached 15-minute OHLCV bars. Because the free provider does not expose
  bid/ask aggressor volume, bar volume is signed by candle direction and the result
  is explicitly labelled `estimated`. Missing volume returns CVD unavailable.
- GEX is requested only for eligible stock and ETF symbols with a validated options
  chain. Black-Scholes gamma is calculated from strike, expiry, implied volatility,
  and open interest. Calls are treated as positive and puts as negative under an
  explicit dealer-position proxy. This is modelled exposure, not observed dealer
  inventory. Futures, indices, FX, metals, and failed chains return GEX unavailable.

Run deterministic checks with:

```bash
cd backend
npm run lint
npm test
```

Useful checks:

```bash
curl http://localhost:5000/api/system
curl http://localhost:5000/api/dashboard
curl http://localhost:5000/api/evaluations
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000`. By default, same-origin `/api` calls
are proxied to the backend at `http://127.0.0.1:5000`; set
`NEXT_PUBLIC_API_BASE_URL` only when a separate API origin is required.
