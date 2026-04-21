# Environment Variables Configuration

This file should be copied to `.env` and filled with your actual API keys.
DO NOT commit your `.env` file to version control!

## Required Environment Variables

### Supabase Configuration
```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Service Role Key (for storage uploads - bypasses RLS)
# WARNING: Keep this secret! Get it from: Supabase Dashboard → Settings → API → service_role key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

### IPFS / Pinata Configuration (Optional - for decentralized storage)
```
# Pinata JWT Token (for IPFS storage)
# Get your JWT from: https://app.pinata.cloud/ → API Keys → Generate New Key
# Free tier includes 1GB storage and 100 requests/day
VITE_PINATA_JWT=your_pinata_jwt_token

# Optional: Custom Pinata Gateway (defaults to gateway.pinata.cloud)
# VITE_PINATA_GATEWAY=gateway.pinata.cloud
```

### Clerk Authentication Configuration
```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
```

### Google Maps API Configuration
```
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### Resend Email Configuration (Optional)
```
VITE_RESEND_API_KEY=re_your_resend_api_key_here
VITE_EMAIL_FROM=onboarding@resend.dev
# Or use your verified domain: noreply@yourdomain.com
VITE_EMAIL_ENABLED=true
```

**Note:** For Resend setup, see `RESEND_SETUP.md` for detailed instructions.

### Ethereum Sepolia Testnet Configuration
```
# Optional: Custom Sepolia RPC URL (defaults to public RPC if not provided)
VITE_SEPOLIA_RPC_URL=https://rpc.sepolia.org
# Or use Infura/Alchemy:
# VITE_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
# VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# Smart Contract Addresses (after deployment)
# These will be auto-populated from deployment-addresses.json, or set manually:
# VITE_PROPERTY_TOKEN_ADDRESS=0x...
# VITE_PROPERTY_REGISTRY_ADDRESS=0x...
# VITE_ESCROW_ADDRESS=0x...
# VITE_PROPERTY_OFFERS_ADDRESS=0x...

# Hardhat Deployment (for contract deployment)
# IMPORTANT: Use Infura or Alchemy for reliable deployment (public RPCs can timeout)
# SEPOLIA_RPC_URL=https://rpc.sepolia.org
# Or use Infura (recommended):
# SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
# Or use Alchemy:
# SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
# PRIVATE_KEY=your_private_key_here (must start with 0x)
```

## Setup Instructions

1. Copy this template to create your environment file:
   ```bash
   cp ENV_TEMPLATE.md .env
   ```

2. Fill in your actual API keys in the `.env` file

3. Restart your development server after updating environment variables


