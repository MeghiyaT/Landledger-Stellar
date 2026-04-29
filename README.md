<div align="center">
  <h1>🏢 Landledger</h1>
  <p><b>Next-Generation Real Estate & Land Registration Platform</b></p>
  
  [![Stellar](https://img.shields.io/badge/Blockchain-Stellar-000000?style=flat-square&logo=stellar&logoColor=white)](https://stellar.org)
  [![Soroban](https://img.shields.io/badge/Smart_Contracts-Soroban-FF7A59?style=flat-square)](https://soroban.stellar.org)
  [![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
  [![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
  [![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?style=flat-square&logo=clerk&logoColor=white)](https://clerk.com/)
</div>

<br/>

Landledger is a full-stack, Web3-powered real estate application that brings transparency, security, and efficiency to property listings and land registration. Built on the **Stellar network** utilizing **Soroban smart contracts**, Landledger ensures that properties are listed securely, escrow payments are trustless, and ownership transfers are permanently verifiable on the blockchain through NFT deeds.

---

## ✨ Core Platform Features

### 🔗 Blockchain & Smart Contracts
* **On-Chain Property Registry:** Every verified property is anchored to the Stellar Testnet via the Soroban `PropertyRegistry` contract, ensuring an immutable record of existence.
* **Trustless Escrow Payments:** Buyers lock XLM funds securely in the `Escrow` smart contract. Funds are only released to the seller once the transaction is finalized, eliminating counterparty risk.
* **NFT Deed Minting & Transfers:** Upon property registration, a unique SEP-50 compliant NFT is minted as the digital deed. When an escrow transaction successfully completes, ownership of this NFT deed automatically transfers from the seller's wallet to the buyer's wallet.

### 🏘️ Real Estate Marketplace
* **Interactive Discovery:** Browse, filter, and compare active listings with an integrated Google Maps view and geocoding.
* **Offer Management:** Buyers can seamlessly place structured financial offers on properties. Sellers can review, accept, or decline offers through a dedicated dashboard.
* **Ownership History:** Read-only tracking of a property's complete transaction and ownership history directly on the property details page.

### 💬 Communication & Notifications
* **In-App Messaging & Inquiries:** Direct, secure communication channels between buyers and sellers regarding specific property listings.
* **Real-Time Notification System:** Persistent, polled notification center alerting users to new offers, accepted transactions, and required blockchain signatures.
* **Automated Emails:** Integration with Resend via Edge Functions for transactional email alerts.

### 🛡️ Admin Controls & Security
* **Admin Verification Portal:** Centralized dashboard for platform administrators to review KYC/AML documents, verify user registrations, and approve properties before they go live on the marketplace.
* **IPFS Decentralized Storage:** Legal documents and property metadata are pinned to IPFS via Pinata, guaranteeing immutability and resistance to censorship.
* **Secure Architecture:** 100% decoupling of sensitive keys (Supabase Service Role, Pinata JWT, Resend API) from the frontend bundle. All privileged actions are routed through secure Supabase Edge Functions.
* **Clerk + RLS:** Authentication powered by Clerk, with JWTs injected into Supabase to enforce strict Row Level Security (RLS) on all database interactions.

---

## 🏗️ Technical Architecture

```text
Landledger/
├── soroban-contracts/         # Soroban smart contracts (Rust)
│   ├── property-registry/     # On-chain property registration & anchoring
│   ├── escrow/                # Multi-party escrow for XLM transactions
│   ├── property-nft/          # SEP-50 ownership certificates (Deeds)
│   ├── property-token/        # SEP-41 custom platform token
│   └── property-offers/       # On-chain offer logic
├── supabase/
│   ├── functions/             # Secure Edge Functions (Pinata, Emails, NFT Minting)
│   └── migrations/            # Versioned DB migrations (run via Supabase CLI)
├── src/
│   ├── components/            # Reusable UI & layout elements
│   ├── pages/                 # Route-level React components (Dashboard, Marketplace)
│   ├── services/              # Supabase data access & Soroban RPC integration
│   ├── hooks/                 # Custom React hooks (useWallet, etc.)
│   └── lib/                   # Integrations (Clerk JWT bridge, Supabase client)
├── scripts/                   # Bash deployment & maintenance scripts
├── contracts/                 # Legacy Solidity contracts (Pre-migration)
├── public/                    # Static assets
├── vercel.json                # Vercel SPA routing configuration
├── vite.config.js             # Vite build configuration
└── package.json               # Dependencies & NPM scripts
```

---

## 🧰 Technology Stack

| Layer | Technology |
|:---|:---|
| **Frontend** | React 18, Vite, React Router v6, Tailwind CSS |
| **Authentication** | Clerk (JWT injected securely into Supabase) |
| **Database** | Supabase (PostgreSQL) + Edge Functions (Deno) |
| **Storage** | Supabase Storage + Pinata / IPFS (Immutable docs) |
| **Blockchain** | Stellar Testnet, `@stellar/stellar-sdk`, Freighter Wallet |
| **Smart Contracts** | Soroban (Rust), `wasm32v1-none` target |
| **Email** | Resend API (via Edge Functions) |
| **Mapping** | Google Maps API |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- **[Freighter Wallet](https://www.freighter.app/)** browser extension
- Stellar Testnet XLM (Available via the [Stellar Laboratory Faucet](https://laboratory.stellar.org/#account-creator?network=test))
- [Supabase](https://supabase.com) project & [Clerk](https://clerk.com) application

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

# Stellar Soroban Contracts
VITE_PROPERTY_REGISTRY_ADDRESS=C...
VITE_PROPERTY_NFT_ADDRESS=C...
VITE_PROPERTY_TOKEN_ADDRESS=C...
VITE_ESCROW_ADDRESS=C...
```

### 3 · Deploy Edge Functions

To ensure file uploads and emails work securely, deploy the Edge Functions:

```bash
npx supabase secrets set --env-file .env --project-ref <your-project-ref>
npx supabase functions deploy --project-ref <your-project-ref>
```

### 4 · Start the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔐 Security Details

- **No privileged keys on the frontend** — all client requests use the anon key + a Clerk JWT.
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
