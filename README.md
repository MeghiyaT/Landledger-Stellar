# Landledger — Real Estate & Land Registration Platform

> **Hackathon Edition** · Sepolia Testnet · Supabase · Clerk Auth

A full-stack React application for real estate property listings and blockchain-backed land registration, built for the Web3 era. Properties are listed on-chain via the `PropertyRegistry` smart contract, payments are secured through an `Escrow` contract, and ownership history is permanently verifiable on the Ethereum Sepolia testnet.

---

## ✨ Features

| Category | Highlights |
|---|---|
| **Property Marketplace** | Browse, filter & compare listings; for-sale and for-rent |
| **Land Registration** | Multi-step form with document upload to Supabase Storage + IPFS via Pinata |
| **Blockchain Ownership** | On-chain registry of every property; ownership history viewable on Etherscan |
| **Escrow Payments** | PROP token (ERC-20) escrow — funds released only on both-party confirmation |
| **NFT Certificates** | Mint property ownership NFTs upon successful transaction |
| **User Dashboard** | Track listings, offers, transactions, purchases, and notifications |
| **Admin Dashboard** | Moderate registrations, manage listings, audit transactions |
| **Real-time Notifications** | In-app notification centre with 30-second polling |
| **Google Maps** | Interactive map views with property geocoding |

---

## 🏗️ Architecture

```
Landledger/
├── contracts/                 # Solidity smart contracts (Hardhat)
│   ├── PropertyRegistry.sol   # On-chain property registration & ownership
│   ├── Escrow.sol             # Multi-party escrow for transactions
│   ├── PropertyNFT.sol        # ERC-721 ownership certificates
│   └── PropertyOffers.sol     # On-chain offer management
├── scripts/                   # Hardhat deployment scripts + Supabase migration tools
├── supabase/
│   ├── migrations/            # Versioned DB migrations (run via Supabase CLI)
│   └── seed.sql               # Sample data for local dev
└── src/
    ├── components/
    │   ├── ui/                # Base design-system components (Button, Modal, Badge…)
    │   ├── layout/            # Header, Footer, Section
    │   ├── BlockchainBadge.jsx
    │   ├── BlockchainOwnershipHistory.jsx
    │   ├── NFTInfo.jsx
    │   ├── NotificationCenter.jsx
    │   └── …
    ├── pages/                 # Route-level page components
    ├── services/              # Supabase data-access layer (thin service modules)
    ├── hooks/                 # Custom React hooks (useWallet, useAutoFillForm, …)
    ├── lib/                   # Third-party clients (supabase.js with Clerk JWT bridge)
    └── utils/                 # Helpers (placeholders, notification utils, admin utils)
```

---

## 🧰 Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, React Router v6, Tailwind CSS |
| **Auth** | Clerk (JWT injected into every Supabase request via `global.fetch` wrapper) |
| **Database** | Supabase (PostgreSQL) with Row Level Security |
| **Storage** | Supabase Storage (property images) + Pinata / IPFS (immutable docs) |
| **Blockchain** | Ethereum Sepolia Testnet, ethers.js v6, MetaMask |
| **Smart Contracts** | Hardhat, OpenZeppelin Contracts v5, PropertyRegistry, Escrow, PropertyNFT |
| **Email** | Resend API |
| **Forms** | React Hook Form |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- [MetaMask](https://metamask.io/) browser extension
- Sepolia testnet ETH → [Sepolia Faucet](https://sepoliafaucet.com/)
- [Supabase](https://supabase.com) project
- [Clerk](https://clerk.com) application
- [Google Maps API Key](https://console.cloud.google.com/)

### 1 · Install dependencies

```bash
npm install
```

### 2 · Configure environment

```bash
cp .env.example .env
```

Edit `.env` and populate every variable. The required keys are:

```env
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_…

# Supabase
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ…

# Google Maps
VITE_GOOGLE_MAPS_API_KEY=AIza…

# Blockchain (optional for read-only browsing)
VITE_PROPERTY_REGISTRY_ADDRESS=0x…
VITE_ESCROW_ADDRESS=0x…
VITE_PROP_TOKEN_ADDRESS=0x…
VITE_PROPERTY_NFT_ADDRESS=0x…
```

### 3 · Run database migrations

Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase db push
```

Or apply `supabase/migrations/20260418000000_init.sql` manually in the Supabase SQL editor.

### 4 · (Optional) Deploy smart contracts

```bash
# Compile
npm run compile

# Deploy to Sepolia
npm run deploy:sepolia

# Individual contracts
npm run deploy:escrow
npm run deploy:nft
```

After deployment, update the contract addresses in `.env`.

### 5 · Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## 🔐 Security

- **No service-role keys on the frontend** — all client requests use the anon key + a Clerk JWT
- **RLS policies** on every Supabase table enforce per-user data access
- **Smart contract guards** — `PropertyRegistry` uses `ownerOf` checks; `Escrow` requires both buyer and seller to confirm before releasing funds
- **Reentrancy protection** — Escrow inherits OpenZeppelin `ReentrancyGuard`

---

## 🛠️ Development Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run compile` | Compile Solidity contracts |
| `npm run deploy:sepolia` | Deploy PropertyRegistry to Sepolia |
| `npm run deploy:escrow` | Deploy Escrow to Sepolia |
| `npm run deploy:nft` | Deploy PropertyNFT to Sepolia |

---

## 📖 Additional Guides

| Guide | Purpose |
|---|---|
| `ETHEREUM_INTEGRATION.md` | Blockchain setup, contract ABIs, wallet flows |
| `SMART_CONTRACTS.md` | Contract architecture and event reference |
| `IPFS_SETUP.md` | Pinata / IPFS configuration for document storage |
| `TESTING_CHECKLIST.md` | End-to-end manual test scenarios |
| `DEPLOYMENT_TROUBLESHOOTING.md` | Common deployment and RLS issues |
| `GET_SEPOLIA_ETH_GUIDE.md` | How to obtain Sepolia test ETH |

---

## License

All rights reserved.
