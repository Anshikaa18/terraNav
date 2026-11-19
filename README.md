# TerraNav / ChunkFlow — Production Monorepo

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org/)
[![Python 3.12](https://img.shields.io/badge/Python-3.12%2B-blue.svg)](https://www.python.org/)

TerraNav is an intelligent multi-modal route optimization, traffic prediction, and dynamic navigation system powered by Aiven Cloud MySQL, TomTom Traffic APIs, and real-time graph routing algorithms.

---

## 1. Monorepo Architecture

This repository is structured as a clean, production-ready monorepo:

```
terranav/
├── frontend/               # React 18 + Vite SPA (Vercel independent deployment)
├── backend/                # Express API + Aiven MySQL + ML Engine (Render independent deployment)
│   ├── api/                # REST endpoints, controllers, security middleware
│   ├── database/           # Aiven MySQL schema & migration files
│   └── ml/                 # Python graph routing & ML prediction engine
├── shared/                 # Domain constants (travel modes, geo bounds) & JSON schemas
└── docs/                   # API reference, setup guides, and Postman collections
```

### 1.1 Service Breakdown
- **Frontend (`frontend/`)**: React 18, Vite 5, Tailwind CSS, Leaflet, and Lucide React. Communicates with the backend using `VITE_API_URL` and is pre-configured for **Vercel** with `frontend/vercel.json`.
- **Backend (`backend/`)**: Node.js / Express 4.21 gateway connected to **Aiven Cloud MySQL** over secure TLS (`DB_SSL=true`). Spawns a persistent Python serving daemon (`backend/ml`) for traffic evaluation, shortest-path calculation (Dijkstra and A*), and dynamic rerouting. Pre-configured for **Render** via `backend/render.yaml`.
- **Shared (`shared/`)**: Canonical domain contracts, supported travel modes (`car`, `motorcycle`, `bicycle`, `pedestrian`), and geographical bounding coordinates.

---

## 2. Quick Start

### 2.1 Prerequisites
- Node.js 18+ and npm
- Python 3.12+ (with requirements in `backend/requirements.txt`)
- An active Aiven Cloud MySQL instance (configured in `backend/.env`)

### 2.2 Installation
```bash
# Install backend dependencies
cd backend
npm install
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
npm install
```

### 2.3 Running Locally
From the monorepo root:
```bash
# Run backend (Port 5000)
npm run start:backend

# Run frontend (Port 5173 with proxy to backend)
npm run start:frontend
```

---

## 3. Testing & Verification

```bash
# Run all test suites across the monorepo
npm run test:all

# Or test individual services:
npm run test:frontend          # Frontend unit tests
npm run test:backend           # Backend API integration tests
npm run test:ml                # Python ML & graph routing tests
```

---

## 4. Production Deployment

### Frontend (Vercel)
1. Import repository on Vercel.
2. Set **Root Directory** to `frontend`.
3. Set Environment Variable: `VITE_API_URL=https://<your-render-backend>.onrender.com`.
4. Deploy!

### Backend (Render)
1. Deploy as a **Web Service** on Render pointing to `backend/render.yaml` (or configure manually with Root Directory `backend`).
2. Build Command: `npm install && pip install -r requirements.txt`
3. Start Command: `node api/server.js`
4. Configure environment variables in the Render Dashboard (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`, `JWT_SECRET`, `TOMTOM_API_KEY`, `CORS_ORIGIN=https://<your-vercel-app>.vercel.app`).
