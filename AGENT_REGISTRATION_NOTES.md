# 🤖 Catatan Pendaftaran AI Trading Agent — NEXA

Dokumen ini mencatat detail arsitektur, kebutuhan env, dan standar pendaftaran Nexa AI Agent di ekosistem Web3 / BNB Chain.

---

## 📌 1. Standar Pendaftaran AI Agent di BNB Chain

Untuk mendaftarkan Nexa AI Agent agar terverifikasi secara on-chain:

### A. Identitas Agen On-Chain (ERC-8004 / Verifiable Agent)
1. **Agent Wallet Address:** Alamat wallet khusus yang dipegang oleh Nexa Agent bot (`0x...`).
2. **Agent URI Metadata (`NEXA_AGENT_URI`):**
   - Format: `ipfs://...` atau URL JSON statis.
   - Berisi schema JSON: nama agent (`Nexa Quant Agent`), versi strategi (GBM Monte Carlo Price Simulator), developer, deskripsi kapabilitas, dan contract addresses.
3. **On-Chain Verifier Contracts:**
   - **Identity Contract:** Memetakan wallet agen ke owner & metadata URI (sudah disiapkan di [NexaIdentity.sol](file:///c:/Users/Bagas%20Winerang/hackathon/nexa/contracts/src/NexaIdentity.sol)).
   - **Journal Contract:** Mencatat log/hash transaksi on-chain secara append-only untuk verifikasi on-chain yang transparan (sudah disiapkan di [NexaJournal.sol](file:///c:/Users/Bagas%20Winerang/hackathon/nexa/contracts/src/NexaJournal.sol)).

---

## ⚙️ 2. Environment Variables yang Dibutuhkan Saat Pendaftaran Agent

Saat tahap registrasi agent diaktifkan nanti, env yang perlu disiapkan:

```env
# --- Identitas On-Chain Nexa Agent ---
NEXA_AGENT_ADDRESS=0x...            # Alamat wallet bot agent Nexa
NEXA_AGENT_URI=ipfs://...         # Link IPFS spesifikasi & metadata agent
NEXA_IDENTITY_CONTRACT=0x...        # Deployed contract NexaIdentity
NEXA_JOURNAL_CONTRACT=0x...         # Deployed contract NexaJournal

# --- Signing & Execution Mode ---
# Opsi 1: Automated Agent Wallet (Private Key)
NEXA_AGENT_PRIVATE_KEY=...          # Private key agent untuk gas fee tBNB

# Opsi 2: Trust Wallet Agent Kit (TWAK)
# TWAK_ACCESS_ID=...
# TWAK_HMAC_SECRET=...
# TWAK_WALLET_PASSWORD=...

# --- Network ---
BSC_CHAIN_ID=97                     # 97 (Testnet) / 56 (Mainnet)
BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
```

---

## 🏗️ 3. Kesiapan Nexa Saat Ini

Nexa sudah memiliki fondasi smart contract yang tepat:
- [contracts/src/NexaIdentity.sol](file:///c:/Users/Bagas%20Winerang/hackathon/nexa/contracts/src/NexaIdentity.sol) → Siap meregister profil agent on-chain.
- [contracts/src/NexaJournal.sol](file:///c:/Users/Bagas%20Winerang/hackathon/nexa/contracts/src/NexaJournal.sol) → Siap mencatat bukti eksekusi / log prediksi finansial on-chain.
- [contracts/script/Deploy.s.sol](file:///c:/Users/Bagas%20Winerang/hackathon/nexa/contracts/script/Deploy.s.sol) → Script Foundry untuk langsung deploy ke BSC Testnet.
