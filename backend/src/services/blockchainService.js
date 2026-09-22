const { ethers } = require('ethers');
const LandParcel = require('../models/LandParcel');
const fs         = require('fs');
const path       = require('path');

// ── Load ABIs ─────────────────────────────────────────────────────────────────
const abiPath = path.join(__dirname, '../config/abis');

let landRegistryABI, transferABI, addresses;

try {
  landRegistryABI = JSON.parse(
    fs.readFileSync(path.join(abiPath, 'LandRegistry.json'))
  ).abi;
  transferABI = JSON.parse(
    fs.readFileSync(path.join(abiPath, 'TransferContract.json'))
  ).abi;
  addresses = JSON.parse(
    fs.readFileSync(path.join(abiPath, 'addresses.json'))
  );
} catch (e) {
  console.warn('⚠️  Blockchain ABIs not found — run deploy script first');
}

let provider, signer, landRegistry, transferContract;

// ── Initialise connection ─────────────────────────────────────────────────────
const init = () => {
  try {
    if (!process.env.ALCHEMY_API_URL || !process.env.PRIVATE_KEY) {
      console.warn('⚠️  Blockchain env vars missing — service disabled');
      return;
    }
    if (!landRegistryABI || !addresses) {
      console.warn('⚠️  ABIs not found. Run: cd blockchain && npx hardhat run scripts/deploy.js --network sepolia');
      return;
    }

    provider         = new ethers.JsonRpcProvider(process.env.ALCHEMY_API_URL);
    signer           = new ethers.Wallet(`0x${process.env.PRIVATE_KEY}`, provider);
    landRegistry     = new ethers.Contract(addresses.LandRegistry,     landRegistryABI, signer);
    transferContract = new ethers.Contract(addresses.TransferContract,  transferABI,    signer);

    console.log('✅ Blockchain service ready (Sepolia)');
    console.log(`   LandRegistry:     https://sepolia.etherscan.io/address/${addresses.LandRegistry}`);
    console.log(`   TransferContract: https://sepolia.etherscan.io/address/${addresses.TransferContract}`);
  } catch (err) {
    console.error('❌ Blockchain init failed:', err.message);
  }
};

// ── Mint Land NFT ─────────────────────────────────────────────────────────────
const mintLandNFT = async (parcelId, ownerAddress, locationData, area, landType, score, ipfsDocHash) => {
  try {
    if (!landRegistry) throw new Error('Blockchain service not initialized');

    // Build arguments
    const locationString = `${locationData.lat},${locationData.lng}`;
    const locationHash   = ethers.keccak256(ethers.toUtf8Bytes(locationString));
    const tokenURI       = ipfsDocHash
      ? `ipfs://${ipfsDocHash}`
      : `https://api.landchain.io/metadata/${parcelId}`;

    // score must be uint8 (0-100)
    const safeScore = Math.min(Math.max(Math.round(score || 0), 0), 100);

    console.log(`⛓️  Minting NFT for parcel: ${parcelId}`);
    console.log(`   Owner:      ${ownerAddress}`);
    console.log(`   Area:       ${area} sqm`);
    console.log(`   Land type:  ${landType}`);
    console.log(`   Score:      ${safeScore}`);

    const tx = await landRegistry.mintLandParcel(
      ownerAddress,       // address to
      parcelId,           // string parcelId
      locationHash,       // bytes32 locationHash  ← keccak256 hash
      area,               // uint256 areaInSqMeters
      landType,           // string landType
      safeScore,          // uint8 verificationScore
      ipfsDocHash || '',  // string ipfsDocHash
      tokenURI            // string tokenURI_
    );

    console.log(`   Tx sent: ${tx.hash} — waiting for confirmation...`);
    const receipt = await tx.wait();
    console.log(`   Confirmed in block: ${receipt.blockNumber}`);

    // ── Extract tokenId from ParcelMinted event ───────────────────
    // Contract emits:
    // event ParcelMinted(uint256 indexed tokenId, string indexed parcelId,
    //                    address indexed owner, uint256 areaInSqMeters, string landType)
    let tokenId = null;

    for (const log of receipt.logs) {
      try {
        const parsed = landRegistry.interface.parseLog(log);
        if (!parsed) continue;

        if (parsed.name === 'ParcelMinted') {
          // args[0] = tokenId (first param in event)
          tokenId = parsed.args.tokenId?.toString() || parsed.args[0]?.toString();
          console.log(`   ✅ tokenId from ParcelMinted event: ${tokenId}`);
          break;
        }
      } catch {
        // log from different contract (e.g. ERC721 Transfer) — skip
      }
    }

    // ── Fallback: use totalParcels() — your contract's counter function ──
    // NOTE: contract has totalParcels() NOT totalSupply()
    if (!tokenId) {
      try {
        const total = await landRegistry.totalParcels();
        tokenId     = total.toString();
        console.log(`   ⚠️  tokenId from totalParcels() fallback: ${tokenId}`);
      } catch (err) {
        console.error('   ❌ totalParcels() failed:', err.message);
        tokenId = null;
      }
    }

    if (!tokenId) {
      throw new Error('Could not determine tokenId from transaction — check contract events');
    }

    // ── Update MongoDB ────────────────────────────────────────────
    await LandParcel.findByIdAndUpdate(parcelId, {
      tokenId,
      blockchainTxHash: receipt.hash,
      isOnChain:        true,
    });

    console.log(`✅ NFT minted — tokenId: ${tokenId}, tx: ${receipt.hash}`);
    return { tokenId, txHash: receipt.hash };

  } catch (err) {
    console.error('❌ Mint failed:', err.message);
    throw err;
  }
};

// ── Transfer NFT to buyer (called after all parties approve) ─────────────────
const transferNFT = async (tokenId, buyerWallet) => {
  console.log(`ℹ️  transferNFT called for tokenId=${tokenId} — skipped.`);
  console.log(`   Transfer is handled on-chain by government MetaMask signature.`);
  return null;
};

// ── Update Verification Score On-Chain ────────────────────────────────────────
const updateVerificationScore = async (tokenId, newScore) => {
  try {
    if (!landRegistry) return null;
    const safeScore = Math.min(Math.max(Math.round(newScore || 0), 0), 100);
    const tx        = await landRegistry.updateVerificationScore(tokenId, safeScore);
    const receipt   = await tx.wait();
    console.log(`✅ Score updated on-chain: tokenId=${tokenId}, score=${safeScore}`);
    return receipt.hash;
  } catch (err) {
    console.error('❌ Score update failed:', err.message);
    throw err;
  }
};

// ── Get Parcel From Chain ─────────────────────────────────────────────────────
const getParcelFromChain = async (tokenId) => {
  try {
    if (!landRegistry) return null;
    return await landRegistry.getParcel(tokenId);
  } catch (err) {
    console.error('❌ getParcel failed:', err.message);
    return null;
  }
};

// ── List Parcel On-Chain ──────────────────────────────────────────────────────
// Contract requires onlyParcelOwner — server wallet CANNOT sign this.
// Owner must call listParcel() from frontend via MetaMask.
// MongoDB listing (isListed=true) is used for marketplace display.
const listParcelOnChain = async (tokenId, priceInEth) => {
  console.log(`ℹ️  On-chain listing skipped for tokenId ${tokenId} — owner must sign from frontend MetaMask`);
  return null;
};

// ── Get Contract Addresses ────────────────────────────────────────────────────
const getAddresses = () => addresses || {};

module.exports = {
  init,
  mintLandNFT,
  updateVerificationScore,
  getParcelFromChain,
  listParcelOnChain,
  transferNFT,
  getAddresses,
};