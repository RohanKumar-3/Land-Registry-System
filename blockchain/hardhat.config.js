import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-toolbox";
// import "@nomicfoundation/hardhat-network-helpers";
import dotenv from "dotenv";

dotenv.config();

// Safety check — warn if keys are missing
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0".repeat(64);
const SEPOLIA_RPC_URL = process.env.ALCHEMY_SEPOLIA_URL || "";
const ETHERSCAN_API = process.env.ETHERSCAN_API_KEY || "";

export default {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  // ── Networks ──────────────────────────────────────────────────────────────
  networks: {
    // Local Hardhat node — for development & testing
    hardhat: {
      type:"edr-simulated",
      chainId: 31337,
    },

    // Local node started with: npx hardhat node
    localhost: {
      type:"http",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // Sepolia testnet — PRIMARY deployment target
    sepolia: {
       type: "http",
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY !== "0".repeat(64) ? [`0x${PRIVATE_KEY}`] : [],
      chainId: 11155111,
      gasPrice: "auto",
      timeout: 120000,
    },
  },

  // ── Etherscan verification ────────────────────────────────────────────────
  etherscan: {
    apiKey:ETHERSCAN_API,
    },

  // ── Gas reporter ─────────────────────────────────────────────────────────
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    network: "sepolia",
  },

  // ── Paths ─────────────────────────────────────────────────────────────────
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  sourcify: {
  enabled: true
}
};
