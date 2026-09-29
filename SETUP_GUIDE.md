# 🔑 Nexa — Environment Variables & External Integration Guide

Panduan lengkap semua yang perlu kamu setup agar Nexa jalan 100%.

---

## 📊 Status Checklist

| # | Item | Wajib? |
|:--|:-----|:-------|
| 1 | Google Gemini API Key | ✅ Wajib |
| 2 | Supabase Project (URL + Anon Key) | ✅ Wajib |
| 3 | Supabase Table Schema | ✅ Wajib |
| 4 | Binance API Key | ❌ Opsional |
| 5 | BSC Testnet RPC | ❌ Opsional (default ada) |
| 6 | MetaMask + BSC Testnet | ✅ Wajib (untuk Web3) |
| 7 | Foundry (forge) | ✅ Wajib (untuk deploy contracts) |
| 8 | Deploy Smart Contracts | ✅ Wajib (untuk on-chain features) |
| 9 | tBNB Faucet | ✅ Wajib (untuk deploy + test) |

---

## 1️⃣ Google Gemini API Key

**Untuk:** AI chatbot di backend (Gemini 2.0 Flash + Function Calling)

**Cara dapat:**
1. Buka https://aistudio.google.com/apikey
2. Klik "Create API Key"
3. Pilih project (atau buat baru)
4. Copy API key

**Taruh di:** `backend/.env`
```env
GOOGLE_GEMINI_API_KEY=AIzaSy...your-key-here
```

**Gratis?** Ya, free tier cukup untuk development (15 RPM, 1.5M tokens/day)

---

## 2️⃣ Supabase Project

**Untuk:** Database transaksi keuangan (CRUD cashflow harian)

**Cara setup:**
1. Buka https://supabase.com → Sign up / Login
2. Klik "New Project"
3. Isi nama project (e.g. "nexa"), pilih region terdekat, buat password DB
4. Tunggu project selesai provisioning (~1 menit)
5. Pergi ke **Settings → API**:
   - Copy **Project URL** → `SUPABASE_URL`
   - Copy **anon public key** → `SUPABASE_ANON_KEY`

**Taruh di:** `backend/.env`
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...your-anon-key
```

**Gratis?** Ya, free tier: 500MB database, 50K monthly active users

---

## 3️⃣ Supabase Table Schema

**Untuk:** Struktur tabel `transactions` di database

**Cara setup:**
1. Di Supabase Dashboard → **SQL Editor**
2. Jalankan query ini:

```sql
-- Tabel transaksi keuangan
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  note TEXT DEFAULT '',
  is_income BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index untuk query per user
CREATE INDEX idx_transactions_user ON transactions(user_address);

-- Enable Row Level Security (opsional tapi recommended)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy: semua bisa read/write (untuk development)
CREATE POLICY "Allow all operations" ON transactions
  FOR ALL USING (true) WITH CHECK (true);
```

3. Klik "Run"

---

## 4️⃣ Binance API Key (OPSIONAL)

**Untuk:** Fetching market data dari Binance

**Status:** **TIDAK WAJIB** — kode sudah pakai Binance **public API** yang tidak butuh key.
Public endpoints (`/api/v3/klines`, `/api/v3/ticker/24hr`) gratis tanpa autentikasi.

**Kapan butuh key?** Hanya kalau nanti mau akses:
- Trading API (beli/jual)
- Account data
- WebSocket streams dengan rate limit tinggi

**Kalau tetap mau setup:**
1. Buka https://www.binance.com → API Management
2. Create API key
3. Taruh di `engine/.env`:
```env
BINANCE_API_KEY=your-key
BINANCE_SECRET_KEY=your-secret
```

---

## 5️⃣ BSC Testnet RPC

**Untuk:** Koneksi frontend ke BSC Testnet blockchain

**Status:** Default sudah ada — pakai public RPC Binance:
```
https://data-seed-prebsc-1-s1.binance.org:8545
```

**Kalau mau RPC yang lebih stabil/cepat (opsional):**
- https://chainlist.org/chain/97 → pilih RPC lain
- Atau pakai Alchemy/QuickNode BSC Testnet (gratis)

**Taruh di:** `frontend/.env.local`
```env
NEXT_PUBLIC_BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
```

---

## 6️⃣ MetaMask + BSC Testnet

**Untuk:** Connect wallet di frontend, sign transaksi on-chain

**Cara setup:**
1. Install MetaMask extension: https://metamask.io
2. Buat wallet (atau import existing)
3. Tambahkan BSC Testnet network:
   - Network Name: `BSC Testnet`
   - RPC URL: `https://data-seed-prebsc-1-s1.binance.org:8545`
   - Chain ID: `97`
   - Currency Symbol: `tBNB`
   - Block Explorer: `https://testnet.bscscan.com`

**Atau cara cepat:** Buka https://chainlist.org/chain/97 → klik "Add to MetaMask"

---

## 7️⃣ tBNB Faucet (Testnet BNB)

**Untuk:** Gas fee saat deploy contracts dan test transaksi on-chain

**Cara dapat tBNB gratis:**
1. Buka https://www.bnbchain.org/en/testnet-faucet
2. Paste alamat MetaMask kamu
3. Klik "Give me BNB" → dapat 0.1-0.5 tBNB

**Alternatif faucet:**
- https://testnet.binance.org/faucet-smart

---

## 8️⃣ Foundry (forge) — Deploy Smart Contracts

**Untuk:** Compile & deploy NexaIdentity + NexaJournal ke BSC Testnet

**Install Foundry:**
```bash
# Windows (via scoop)
scoop install foundry

# Atau via curl (Git Bash / WSL)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

**Install dependencies & deploy:**
```bash
cd contracts

# Install forge-std (testing library)
forge install foundry-rs/forge-std --no-commit

# Run tests
forge test -vvv

# Deploy ke BSC Testnet
forge script script/Deploy.s.sol:DeployNexa \
  --rpc-url https://data-seed-prebsc-1-s1.binance.org:8545 \
  --private-key YOUR_METAMASK_PRIVATE_KEY \
  --broadcast
```

**PENTING:** Jangan pernah commit private key! Gunakan `--private-key` flag atau env var `PRIVATE_KEY`.

**Setelah deploy**, copy contract addresses dan taruh di:
```env
# frontend/.env.local
NEXT_PUBLIC_NEXA_IDENTITY_ADDRESS=0x...deployed-address
NEXT_PUBLIC_NEXA_JOURNAL_ADDRESS=0x...deployed-address
```

---

## 📋 Ringkasan Semua ENV Files

### `backend/.env` (2 wajib, 1 opsional)
```env
# [WAJIB] Google Gemini AI
GOOGLE_GEMINI_API_KEY=

# [WAJIB] Supabase Database
SUPABASE_URL=
SUPABASE_ANON_KEY=

# [OPSIONAL] Python engine URL (default sudah benar)
PYTHON_ENGINE_URL=http://localhost:3002
```

### `engine/.env` (semua opsional)
```env
# [OPSIONAL] Binance API - tidak dibutuhkan untuk public endpoints
BINANCE_API_KEY=
BINANCE_SECRET_KEY=
```

### `frontend/.env.local` (2 opsional, 2 setelah deploy)
```env
# [OPSIONAL] Backend URL (default sudah benar)
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001

# [OPSIONAL] BSC Testnet RPC (default sudah benar)
NEXT_PUBLIC_BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545

# [ISI SETELAH DEPLOY CONTRACTS]
NEXT_PUBLIC_NEXA_IDENTITY_ADDRESS=
NEXT_PUBLIC_NEXA_JOURNAL_ADDRESS=
```

---

## 🚦 Urutan Setup yang Recommended

```
Step 1: Dapatkan Gemini API Key          → 2 menit
Step 2: Buat Supabase project + tabel    → 5 menit
Step 3: Isi backend/.env                 → 1 menit
Step 4: Jalankan Engine + Backend + Frontend → langsung jalan!

--- Ini sudah cukup untuk fitur: Chat AI, Monte Carlo, Finance tracking ---

Step 5: Install MetaMask + BSC Testnet   → 3 menit
Step 6: Dapatkan tBNB dari faucet        → 2 menit
Step 7: Install Foundry                  → 3 menit
Step 8: Deploy contracts                 → 2 menit
Step 9: Isi contract addresses di frontend → 1 menit

--- Sekarang fitur on-chain (journal blockchain) juga aktif ---
```

**Total waktu setup: ~20 menit**
