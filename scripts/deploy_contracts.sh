#!/bin/bash
set -e

# Configuration
NETWORK="testnet"
SOURCE="deployer"
WASM_DIR="soroban-contracts/target/wasm32v1-none/release"
ADMIN=$(stellar keys address $SOURCE)

echo "Admin address: $ADMIN"

# Deploy contracts
echo "Deploying Property Registry..."
REGISTRY_ID=$(stellar contract deploy --wasm $WASM_DIR/property_registry.wasm --source $SOURCE --network $NETWORK)
echo "Registry ID: $REGISTRY_ID"

echo "Deploying Property NFT..."
NFT_ID=$(stellar contract deploy --wasm $WASM_DIR/property_nft.wasm --source $SOURCE --network $NETWORK)
echo "NFT ID: $NFT_ID"

echo "Deploying Property Token..."
TOKEN_ID=$(stellar contract deploy --wasm $WASM_DIR/property_token.wasm --source $SOURCE --network $NETWORK)
echo "Token ID: $TOKEN_ID"

echo "Deploying Escrow..."
ESCROW_ID=$(stellar contract deploy --wasm $WASM_DIR/escrow.wasm --source $SOURCE --network $NETWORK)
echo "Escrow ID: $ESCROW_ID"

echo "Deploying Property Offers..."
OFFERS_ID=$(stellar contract deploy --wasm $WASM_DIR/property_offers.wasm --source $SOURCE --network $NETWORK)
echo "Offers ID: $OFFERS_ID"

# Initialize contracts
echo "Initializing Property Registry..."
stellar contract invoke --id $REGISTRY_ID --source $SOURCE --network $NETWORK -- init --admin $ADMIN

echo "Initializing Property NFT..."
stellar contract invoke --id $NFT_ID --source $SOURCE --network $NETWORK -- init --admin $ADMIN

echo "Initializing Property Token..."
stellar contract invoke --id $TOKEN_ID --source $SOURCE --network $NETWORK -- init --admin $ADMIN

echo "Initializing Escrow..."
stellar contract invoke --id $ESCROW_ID --source $SOURCE --network $NETWORK -- init --admin $ADMIN --registry $REGISTRY_ID

echo "Initializing Property Offers..."
stellar contract invoke --id $OFFERS_ID --source $SOURCE --network $NETWORK -- init --admin $ADMIN --registry $REGISTRY_ID

echo "---"
echo "Deployment Complete!"
echo "REGISTRY_ID=$REGISTRY_ID"
echo "NFT_ID=$NFT_ID"
echo "TOKEN_ID=$TOKEN_ID"
echo "ESCROW_ID=$ESCROW_ID"
echo "OFFERS_ID=$OFFERS_ID"
