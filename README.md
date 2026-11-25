# MedTrack — Medicine Shortage Tracker & Alert System

A full-stack **medicine inventory, shortage tracking and alert system** for hospitals and pharmacies. It monitors stock levels and expiry dates, enforces FEFO (First Expiry, First Out) issuing, generates automatic shortage/expiry alerts, predicts future demand, and recommends restock quantities.

- **Frontend:** React 18 · Vite · Tailwind CSS · Recharts · React Router v6
- **Backend:** FastAPI · SQLAlchemy 2 · SQLite (default) · JWT auth
- **Tests:** pytest (25 backend API tests)

## Features

- **Dashboard** — live inventory health score, stock status overview, expiry risk, monthly usage, stock movements, priority alerts and recent activity.
- **Medicines** — full catalog with filters (category, stock status, expiry), sorting, search, add/edit/view, and stock history.
- **Stock Management** — stock-in (with batch, supplier, expiry), stock-out/issue (FEFO), adjustments, and a complete transaction history.
- **Shortage Alerts** — automatic low-stock / out-of-stock alerts with priority levels, auto-generated and resolvable.
- **Expiry Monitor** — track expiring and expired batches with configurable warning window.
- **Demand Prediction** — monthly demand forecasts from historical usage and recommended reorder quantities; create restock requests.
- **Suppliers** — manage suppliers linked to medicines and batches.
- **Reports** — 8 CSV exports (inventory, low stock, expiring, expired, stock movements, usage, alerts, restock requests).
- **Notifications** — in-app notifications with read/unread, plus a live dropdown in the top bar.
- **Global Search** — search medicines, codes, generics, brands, suppliers and transactions.
- **Settings** — configure the expiry warning window and view system info / business rules.
- **Audit** — every stock change creates an auditable transaction; deletions of medicines with history soft-disable instead of hard-delete.

## Business Rules

- Stock can never go negative — issuing more than available is rejected (`Insufficient stock available.`).
- Expired batches are never issued; FEFO prioritizes the earliest-expiring batch first.
- Every stock-in / stock-out / adjustment writes a `StockTransaction` (previous/new stock, reference, user).
- Expiry date must be on or after the manufacturing date.
- Low-stock and expiry alerts are regenerated automatically on startup and after stock changes.
- Medicines with transaction history are deactivated (`is_active = false`) on delete instead of being removed.

## Project Structure

```
medicine_alert/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, lifespan init/seed/alerts
│   │   ├── config.py          # Env-driven settings
│   │   ├── database.py        # SQLAlchemy engine + session
│   │   ├── models.py          # ORM models
│   │   ├── schemas.py         # Pydantic v2 schemas
│   │   ├── auth.py / deps.py  # JWT auth + dependencies
│   │   ├── seed.py            # Demo data seeding
│   │   ├── routes/            # auth, dashboard, medicines, stock, alerts,
│   │   │                      # expiry, prediction, suppliers, reports,
│   │   │                      # notifications, search, restock, settings
│   │   ├── services/          # stock, alert, expiry(FEFO), prediction, health
│   │   └── utils/helpers.py
│   └── tests/                 # test_api.py (25 tests) + conftest.py
├── frontend/
│   └── src/
│       ├── App.jsx            # Routes
│       ├── layouts/Layout.jsx # Sidebar, topbar, notifications, clock
│       ├── components/ui.jsx  # Shared UI primitives + toast
│       ├── context/AuthContext.jsx
│       ├── services/api.js    # Axios API clients + error helper
│       └── pages/             # Login, Dashboard, Medicines, MedicineAdd,
│                              # MedicineEdit, MedicineDetail, Stock,
│                              # StockHistory, Issue, Alerts, Expiry,
│                              # Prediction, Suppliers, Reports,
│                              # Notifications, Search, Settings
├── database/schema.sql        # Reference SQL schema
├── .env.example
└── README.md
```

## Getting Started

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows (or: source .venv/bin/activate)
pip install -r requirements.txt
copy ..\.env.example ..\.env      # Windows (or: cp ../.env.example ../.env)
uvicorn app.main:app --reload
```

On first startup the SQLite database (`backend/medicine_shortage.db`) is created, demo data is seeded, and alerts are generated. API docs are available at <http://127.0.0.1:8000/docs>.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The Vite dev server proxies `/api` to `http://127.0.0.1:8000`.

### 3. Demo accounts

| Role | Username | Password |
| ---- | -------- | -------- |
| Admin | `admin` | `admin123` |
| Pharmacist | `pharmacist` | `pharma123` |

### 4. Running tests

```bash
cd backend
.venv\Scripts\python.exe -m pytest tests -q
```

## Environment Variables (`.env`)

See [`.env.example`](.env.example) for all options. Key settings:

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `SECRET_KEY` | dev fallback | JWT signing secret — **change in production** |
| `DATABASE_URL` | SQLite path | e.g. `mysql+pymysql://user:pass@localhost/medtrack` |
| `EXPIRY_WARNING_DAYS` | `30` | days before expiry to flag "Expiring Soon" |
| `SEED_ON_STARTUP` | `true` | seed demo data on startup |
| `CORS_ORIGINS` | Vite origins | comma-separated allowed origins |

## API Overview

All routes are prefixed `/api` and require a `Bearer` JWT except login.

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/auth/login` | Authenticate, returns JWT |
| GET | `/api/auth/me` | Current user |
| GET | `/api/dashboard/summary` | Dashboard stats + health |
| GET | `/api/medicines` | List with filters/sort/pagination |
| POST | `/api/medicines` | Create medicine |
| GET/PUT/DELETE | `/api/medicines/{id}` | View / update / delete |
| GET | `/api/medicines/{id}/history` | Stock transaction history |
| POST | `/api/stock/in` | Stock in (batch/supplier/expiry) |
| POST | `/api/stock/out` | Issue stock (FEFO) |
| POST | `/api/stock/adjust` | Stock adjustment |
| GET | `/api/stock/history` | Global transaction history |
| GET | `/api/alerts` | Active shortage alerts |
| GET | `/api/expiry` | Expiry monitor (optional `medicine_id`) |
| GET | `/api/prediction/forecast` | Demand forecast + reorder advice |
| POST | `/api/restock/requests` | Create restock request |
| GET | `/api/suppliers` | List suppliers |
| GET | `/api/reports/*` | CSV report exports |
| GET | `/api/notifications` | Notifications (unread first) |
| GET | `/api/search?q=` | Global search |
| GET/PUT | `/api/settings` | System settings (expiry warning window) |
