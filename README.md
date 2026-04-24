<div align="center">
  <h1>🏢 Landledger</h1>
  <p><b>Next-Generation Real Estate & Land Registration Platform</b></p>
  
  [![Stellar](https://img.shields.io/badge/Blockchain-Stellar-000000?style=flat-square&logo=stellar&logoColor=white)](https://stellar.org)
  [![Soroban](https://img.shields.io/badge/Smart_Contracts-Soroban-FF7A59?style=flat-square)](https://soroban.stellar.org)
  [![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
  [![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
</div>

<br/>

A full-stack Web3 application for real estate property listings and blockchain-backed land registration. Built on the **Stellar network** utilizing **Soroban smart contracts**, Landledger ensures that properties are listed securely, escrow payments are trustless, and ownership history is permanently verifiable on the Stellar Testnet.

---

## ✨ Key Features

| Category | Highlights |
|:---|:---|
| 🏘️ **Property Marketplace** | Browse, filter & compare listings; for-sale and for-rent |
| 📜 **Land Registration** | Multi-step form with document upload to Supabase Storage + IPFS via Pinata |
| 🔗 **Blockchain Ownership** | On-chain registry of every property via Soroban Rust contracts |
| 🤝 **Escrow Payments** | Secure smart contract escrow — funds released only on both-party confirmation |
| 🏆 **NFT Certificates** | Mint property ownership NFTs (SEP-50 compliant) upon successful transactions |
| 📊 **User Dashboard** | Track listings, offers, transactions, purchases, and notifications |
| 🔔 **Real-time Notifications** | In-app notification centre with 30-second polling |
| 🗺️ **Google Maps** | Interactive map views with property geocoding |

---

## 🏗️ Architecture

```text
Landledger/
├── soroban-contracts/         # Soroban smart contracts (Rust)
│   ├── property-registry/     # On-chain property registration & ownership
│   ├── escrow/                # Multi-party escrow for transactions
│   ├── property-nft/          # SEP-50 ownership certificates
│   ├── property-token/        # SEP-41 custom platform token
│   └── property-offers/       # On-chain offer management
├── scripts/                   # Bash deployment scripts
├── supabase/
│   └── migrations/            # Versioned DB migrations (run via Supabase CLI)
└── src/
    ├── components/            # UI components and blockchain components
    ├── pages/                 # Route-level page components
    ├── services/              # Supabase data-access & Soroban contract RPCs
    ├── hooks/                 # Custom React hooks (useWallet, etc.)
    └── lib/                   # Third-party clients
```

---

## 🧰 Technology Stack

| Layer | Technology |
|:---|:---|
| **Frontend** | React 18, Vite, React Router v6, Tailwind CSS |
| **Auth** | Clerk (JWT injected into every Supabase request) |
| **Database** | Supabase (PostgreSQL) with Row Level Security |
| **Storage** | Supabase Storage + Pinata / IPFS (immutable docs) |
| **Blockchain** | Stellar Testnet, `@stellar/stellar-sdk`, Freighter Wallet |
| **Smart Contracts** | Soroban (Rust), `wasm32v1-none` target |
| **Email** | Resend API |
| **Forms** | React Hook Form |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- **[Freighter Wallet](https://www.freighter.app/)** browser extension
- Stellar Testnet XLM (Available via the [Stellar Laboratory Faucet](https://laboratory.stellar.org/#account-creator?network=test))
- [Supabase](https://supabase.com) project
- [Clerk](https://clerk.com) application
- [Google Maps API Key](https://console.cloud.google.com/)
- *Optional:* Rust toolchain (`rustup target add wasm32v1-none`) to build contracts

### 1 · Install Dependencies

```bash
npm install
```

### 2 · Configure Environment Variables

```bash
cp .env.example .env
```

Populate `.env` with the required keys:

```env
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Supabase
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Google Maps
VITE_GOOGLE_MAPS_API_KEY=AIza...

# Stellar Soroban Contracts
VITE_PROPERTY_REGISTRY_ADDRESS=C...
VITE_PROPERTY_NFT_ADDRESS=C...
VITE_PROPERTY_TOKEN_ADDRESS=C...
VITE_ESCROW_ADDRESS=C...
VITE_PROPERTY_OFFERS_ADDRESS=C...
```

### 3 · Deploy Smart Contracts (Optional)

If you wish to deploy your own instances of the contracts to the testnet:

```bash
# Build the WASM binaries
cargo build --target wasm32v1-none --release --manifest-path soroban-contracts/Cargo.toml

# Deploy and initialize all contracts
./scripts/deploy_contracts.sh
```

Update your `.env` file with the newly outputted contract addresses.

### 4 · Start the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔐 Security

- **No service-role keys on the frontend** — all client requests use the anon key + a Clerk JWT.
- **Row Level Security (RLS)** on every Supabase table enforces strict per-user data access.
- **Smart Contract Guards** — Soroban contracts require proper cryptographic authorization (`require_auth`) for all state-mutating functions.

---

## 🛠️ Development Scripts

| Command | Description |
|:---|:---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |

---

<div align="center">
  <p><i>Built for the Future of Real Estate on Stellar</i></p>
</div>
