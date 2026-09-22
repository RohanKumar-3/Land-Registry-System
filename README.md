# 🌍 LandChain — Blockchain Land Registry System

A **full-stack decentralized land registry platform** powered by **Blockchain, Machine Learning, and Satellite Imagery** to ensure transparent, secure, and tamper-proof land ownership management.

---

## 🚀 Overview

LandChain solves critical issues in traditional land registry systems such as:

- Fraud and forgery  
- Lack of transparency  
- Manual verification delays  
- Complex ownership transfer processes  

It uses **NFT-based ownership**, **AI verification**, and **smart contract escrow** to create a modern, trustless land management system.

---

## 🧠 Key Features

- 🏷️ **Land as NFT (ERC-721)** — Unique digital ownership certificates  
- 🔐 **3-Party Escrow System** — Buyer + Seller + Government approval  
- 🛰️ **AI Land Verification** — Satellite imagery + ML (ResNet-50)  
- 📄 **IPFS Document Storage** — Tamper-proof decentralized storage  
- 🗺️ **Interactive Map Drawing** — Define land boundaries visually  
- 👛 **MetaMask Integration** — Secure blockchain transactions  
- 📊 **Verification Score System** — AI-based approval assistance  
- 📜 **Immutable Ownership History** — Fully auditable records  

---

## 🏗️ Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- Leaflet (Maps)
- Ethers.js

### Backend
- Node.js
- Express.js
- MongoDB

### Blockchain
- Solidity
- Hardhat
- Ethereum Sepolia Testnet
- ERC-721 NFT Standard

### Machine Learning
- Python (Flask)
- TensorFlow / Keras
- ResNet-50
- Google Earth Engine

### Storage & Web3
- IPFS (Pinata)
- MetaMask

---

## ⚙️ System Architecture

```
Frontend (React)
       ↓
Backend API (Node.js + MongoDB)
       ↓
Blockchain (Ethereum Smart Contracts)
       ↓
ML Service (Flask + Satellite + AI)
```

---

## 🔄 Workflow

### 📝 Land Registration

1. User registers & connects MetaMask  
2. Draws land boundaries on map  
3. Uploads documents (stored on IPFS)  
4. ML service verifies land using satellite data  
5. Government approves  
6. NFT minted on blockchain  

---

### 💸 Land Transfer

1. Seller lists land  
2. Buyer initiates purchase (ETH escrow)  
3. Seller approves  
4. Government approves  
5. Smart contract executes:
   - NFT transferred  
   - Payment distributed (99% seller, 1% fee)  

---

## 📊 Verification System

| Score | Status     |
|------|-----------|
| 70–100 | ✅ Verified |
| 40–69  | ⚠️ Pending |
| 0–39   | ❌ Flagged |

---

## 🔐 Security Features

- JWT Authentication  
- Role-Based Access Control (RBAC)  
- Smart Contract Escrow Protection  
- Reentrancy Guard (Solidity)  
- Wallet Verification (MetaMask)  
- Encrypted Passwords (bcrypt)  

---

## 🧪 Testing

- Smart contract unit tests (Hardhat)  
- End-to-end blockchain transactions (Sepolia)  
- ML verification testing  
- IPFS document storage validation  

---

## ⚡ Getting Started

### Clone the Repository

```
git clone https://github.com/NishantChaubey534/Land-Registry-System.git
cd landchain
```

### Setup Frontend

```
cd frontend
npm install
npm run dev
```

### Setup Backend

```
cd backend
npm install
npm run dev
```

### Setup ML Service

```
cd ml
pip install -r requirements.txt
python app/main.py
```

---

## 🌐 Deployment

- Ethereum Sepolia Testnet  
- IPFS (Pinata)  
- Node.js Backend  
- Flask ML Service  

---

## 🚧 Challenges Solved

- NFT transfer authorization using ERC-721 approve()  
- MetaMask provider issues fixed  
- IPFS deduplication handled  
- Google Earth Engine integration  

---

## 🔮 Future Enhancements

- Mobile App  
- Multi-language support  
- Layer-2 scaling  
- Government integration  
- Improved ML model  

---

## 📌 Project Status

- Fully functional prototype  
- End-to-end tested  
- NFT minting & transfer working  
- AI verification integrated  

--- 
