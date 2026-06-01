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

The frontend runs on `http://localhost:3000` and expects the backend at
`http://localhost:5000` unless `NEXT_PUBLIC_API_BASE_URL` is set.
