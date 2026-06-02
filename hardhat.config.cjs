require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.PRIVATE_KEY 
        ? process.env.PRIVATE_KEY.split(',').map(key => key.trim())
        : [],
      chainId: 11155111,
      timeout: 120000, // 120 seconds timeout
      httpHeaders: {},
      // Alternative RPC endpoints (uncomment if primary fails):
      // url: "https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID",
      // url: "https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY",
      // url: "https://sepolia.gateway.tenderly.co",
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 120000,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

