# NEXA — AI-Powered DeFi Finance Dashboard

## 🎯 Tujuan Proyek
Membangun platform keuangan terdesentralisasi (DeFi) berbasis Web3 yang menggabungkan:
- **AI Chatbot** (Gemini) dengan Function Calling untuk analisis pasar real-time
- **Monte Carlo Simulation** untuk prediksi harga crypto (GBM model)
- **Smart Contracts** di BSC Testnet untuk identitas & jurnal keuangan on-chain
- **Dashboard** interaktif untuk cashflow harian + analisis kuantitatif

---

## 🏗️ Arsitektur Microservice

```
[Frontend Next.js :3000]
         │
         └→ (semua request masuk ke sini dulu)
[Backend Hono (TypeScript) :3001]  ← Orchestrator / Pusat Komando
         │                │
         │                └→ (khusus perhitungan berat)
         │        [Python (FastAPI) :3002]  ← Kalkulator Monte Carlo
         │
         └→ (chat, transaksi, dll)
   [Gemini AI, Supabase, dll]
```

---

## 📁 Struktur Folder

| Folder | Tech Stack | Port | Tanggung Jawab |
|:---|:---|:---|:---|
| `contracts/` | Foundry + Solidity | — | Smart contracts BSC Testnet |
| `backend/` | Hono + TypeScript | `:3001` | Pusat komando: routing, chat AI, CRUD transaksi |
| `engine/` | FastAPI + Python + NumPy | `:3002` | Khusus perhitungan berat: Monte Carlo & data pasar |
| `frontend/` | Next.js 15 + Tailwind | `:3000` | UI dashboard, grafik, chatbot, signing Web3 |

---

## 📂 Detail File per Folder

### `contracts/` — Smart Contracts (Foundry + Solidity)
- `src/NexaIdentity.sol` — Kontrak identitas user on-chain
- `src/NexaJournal.sol` — Kontrak jurnal keuangan on-chain
- `script/Deploy.s.sol` — Script deployment ke BSC Testnet
- `test/Nexa.t.sol` — Unit tests untuk smart contracts
- `foundry.toml` — Konfigurasi Foundry

### `backend/` — Backend Utama (Hono + TypeScript)
- `src/index.ts` — Entry point Hono server (:3001)
- `src/routes/monte-carlo.route.ts` — Terima request → panggil Python → return
- `src/routes/chat.route.ts` — Chat Gemini AI + Function Calling
- `src/routes/transaction.route.ts` — CRUD cashflow harian (Supabase)
- `src/services/quant-client.ts` — HTTP client ke Python service (:3002)
- `src/services/gemini.ts` — Google Gemini SDK + Tools
- `src/lib/supabase.ts` — Supabase client
- `src/lib/env.ts` — Environment variables validation
- `src/types/index.ts` — TypeScript type definitions

### `engine/` — Mesin Hitung (Python + FastAPI)
- `main.py` — Entry point FastAPI server (:3002)
- `services/monte_carlo.py` — Rumus GBM + NumPy (3.000 simulasi)
- `services/market_data.py` — Fetcher harga Binance + Fear & Greed Index
- `models/schemas.py` — Pydantic model (request/response)
- `requirements.txt` — Dependencies: numpy, fastapi, uvicorn, httpx

### `frontend/` — Frontend (Next.js 15 + Tailwind)
- `src/app/layout.tsx` — Root layout
- `src/app/page.tsx` — Landing page
- `src/app/dashboard/layout.tsx` — Dashboard layout with sidebar
- `src/app/dashboard/page.tsx` — Dashboard home
- `src/app/dashboard/finance/page.tsx` — Halaman cashflow & transaksi
- `src/app/dashboard/quant/page.tsx` — Halaman analisis Monte Carlo
- `src/components/layout/app-sidebar.tsx` — Sidebar navigasi
- `src/components/layout/connect-wallet.tsx` — Tombol connect wallet Web3
- `src/components/dashboard/balance-cards.tsx` — Kartu saldo & ringkasan
- `src/components/dashboard/monte-carlo-chart.tsx` — Grafik hasil simulasi
- `src/components/chat/chat-drawer.tsx` — Drawer/panel chatbot AI
- `src/components/chat/chat-messages.tsx` — Komponen pesan chat
- `src/hooks/use-monte-carlo.ts` — Hook untuk simulasi Monte Carlo
- `src/hooks/use-nexa-contract.ts` — Hook untuk interaksi smart contract
- `src/lib/api.ts` — Wrapper ke Hono backend
- `src/lib/wagmi.ts` — Konfigurasi Wagmi (Web3)
- `src/lib/contracts.ts` — ABI & address smart contracts
- `src/lib/utils.ts` — Utility functions
- `src/types/monte-carlo.d.ts` — Type definitions Monte Carlo
- `src/types/transaction.d.ts` — Type definitions transaksi

---

## 🔄 Alur Monte Carlo

```
[User ketik di chat] → [Frontend :3000]
                              │
                        POST /api/chat
                              │
                        [Hono BE :3001]
                              │
                   Gemini memanggil tool:
                   "analyze_market(BNBUSDT)"
                              │
                   POST /simulate → HTTP internal
                              │
                   [Python Engine :3002]
                        NumPy hitung
                        3.000 simulasi
                              │
                   Return JSON hasil probabilitas
                              │
                   [Hono BE :3001]
                   Gemini merangkum hasilnya
                              │
                   [Frontend :3000]
                   Tampilkan grafik + jawaban chat
```

---

## 🚀 Cara Menjalankan (Development)

```bash
# Terminal 1: Python Engine
cd nexa/engine
pip install -r requirements.txt
uvicorn main:app --port 3002

# Terminal 2: Hono Backend
cd nexa/backend
npm install
npm run dev    # → localhost:3001

# Terminal 3: Next.js Frontend
cd nexa/frontend
npm install
npm run dev    # → localhost:3000
```

---

## 🔑 Environment Variables yang Dibutuhkan

### `backend/.env`
```env
GOOGLE_GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
PYTHON_ENGINE_URL=http://localhost:3002
```

### `engine/.env`
```env
BINANCE_API_KEY=
BINANCE_SECRET_KEY=
```

### `frontend/.env.local`
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
NEXT_PUBLIC_NEXA_IDENTITY_ADDRESS=
NEXT_PUBLIC_NEXA_JOURNAL_ADDRESS=
```
