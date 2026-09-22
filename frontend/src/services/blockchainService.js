import { ethers } from 'ethers';

// ── Import ABIs + addresses ───────────────────────────────────────────────────
import LandRegistryJSON from '../utils/abis/LandRegistry.json';
import TransferJSON     from '../utils/abis/TransferContract.json';
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../utils/contracts.js';

// Pull out the addresses from the exported object
const LAND_REGISTRY_ADDRESS     = CONTRACT_ADDRESSES.LAND_REGISTRY;
const TRANSFER_CONTRACT_ADDRESS = CONTRACT_ADDRESSES.TRANSFER_CONTRACT;


const LandRegistryABI = LandRegistryJSON.abi;
const TransferABI     = TransferJSON.abi;

// ── Helper: get signer + contract instances from MetaMask ─────────────────────
// Called before every on-chain action
const getContracts = async () => {
  // ── Wait for MetaMask to inject (fixes timing issues) ────────────────────
  if (!window.ethereum) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!window.ethereum) {
    throw new Error('MetaMask not found. Please install MetaMask.');
  }

  // ── Use exact same pattern that works in console ──────────────────────────
  await window.ethereum.request({ method: 'eth_requestAccounts' });

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();

  // ── Switch to Sepolia if needed ───────────────────────────────────────────
  const network = await provider.getNetwork();
  if (network.chainId !== 11155111n) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }],
      });
      // Re-create provider after network switch
      const newProvider = new ethers.BrowserProvider(window.ethereum);
      const newSigner   = await newProvider.getSigner();

      return {
        landRegistry: new ethers.Contract(LAND_REGISTRY_ADDRESS, LandRegistryABI, newSigner),
        transferContract: new ethers.Contract(TRANSFER_CONTRACT_ADDRESS, TransferABI, newSigner),
        signer: newSigner,
        provider: newProvider,
      };
    } catch (err) {
      throw new Error('Please switch MetaMask to Sepolia Testnet and try again.');
    }
  }

  const landRegistry = new ethers.Contract(
    LAND_REGISTRY_ADDRESS,
    LandRegistryABI,
    signer
  );

  const transferContract = new ethers.Contract(
    TRANSFER_CONTRACT_ADDRESS,
    TransferABI,
    signer
  );

  return { landRegistry, transferContract, signer, provider };
};

// ── LISTING STEP: Seller approves TransferContract to move their NFT ──────────
// Called in handleListForSale — seller signs in MetaMask
// Without this, the TransferContract cannot call transferFrom later
export const approveNFTForTransfer = async (tokenId) => {
  const { landRegistry } = await getContracts();

  // Check if already approved — skip if so (saves gas)
  const alreadyApproved = await landRegistry.getApproved(tokenId);
  if (alreadyApproved.toLowerCase() === TRANSFER_CONTRACT_ADDRESS.toLowerCase()) {
    console.log(`NFT #${tokenId} already approved for TransferContract`);
    return null; // no tx needed
  }

  console.log(`Approving TransferContract for NFT #${tokenId}...`);

  // MetaMask popup appears here for seller to sign
  const tx = await landRegistry.approve(TRANSFER_CONTRACT_ADDRESS, tokenId);
  await tx.wait();

  console.log(`✅ NFT #${tokenId} approved. TxHash: ${tx.hash}`);
  return tx.hash;
};

// ── Check if NFT is approved for transfer ────────────────────────────────────
export const isNFTApprovedForTransfer = async (tokenId) => {
  try {
    const { landRegistry } = await getContracts();
    const approved = await landRegistry.getApproved(tokenId);
    return approved.toLowerCase() === TRANSFER_CONTRACT_ADDRESS.toLowerCase();
  } catch {
    return false;
  }
};

// ── BUYING STEP: Buyer calls initiatePurchase on TransferContract + sends ETH ─
// Buyer signs in MetaMask — ETH is locked in the smart contract
// Returns { hash, escrowId } — escrowId must be saved to DB
export const buyParcel = async (tokenId, priceInEth) => {
  const { transferContract } = await getContracts();

  // Convert ETH string to Wei (e.g. "0.5" → 500000000000000000n)
  const priceWei = ethers.parseEther(priceInEth.toString());

  console.log(`Initiating on-chain purchase:`);
  console.log(`  tokenId: ${tokenId}`);
  console.log(`  price:   ${priceInEth} ETH (${priceWei} wei)`);

  // MetaMask popup — buyer pays ETH here
  const tx = await transferContract.initiatePurchase(tokenId, {
    value: priceWei,
  });

  console.log(`Tx sent: ${tx.hash} — waiting for confirmation...`);
  const receipt = await tx.wait();
  console.log(`✅ Purchase confirmed in block: ${receipt.blockNumber}`);

  // ── Extract escrowId from EscrowInitiated event ───────────────────────────
  // Event: EscrowInitiated(uint256 escrowId, uint256 tokenId, address buyer, address seller, uint256 price)
  let escrowId = null;

  for (const log of receipt.logs) {
    try {
      const parsed = transferContract.interface.parseLog(log);
      if (parsed?.name === 'EscrowInitiated') {
        escrowId = parsed.args[0].toString(); // first arg = escrowId
        console.log(`✅ escrowId from event: ${escrowId}`);
        break;
      }
    } catch {
      // skip logs from other contracts
    }
  }

  if (!escrowId) {
    // Fallback: read escrowCounter from contract
    try {
      const counter = await transferContract.escrowCounter();
      escrowId = counter.toString();
      console.log(`⚠️  escrowId from escrowCounter fallback: ${escrowId}`);
    } catch (e) {
      console.error('Could not get escrowId:', e.message);
    }
  }

  return { hash: receipt.hash, escrowId };
};

// ── SELLER APPROVAL: Seller approves the sale on-chain ───────────────────────
// Seller signs in MetaMask
// Called from handleSellerApprove in ParcelDetail
export const sellerApproveOnChain = async (escrowId) => {
  if (!escrowId) throw new Error('escrowId is required for on-chain approval');

  const { transferContract } = await getContracts();

  console.log(`Seller approving escrow #${escrowId} on-chain...`);

  // MetaMask popup for seller
  const tx = await transferContract.sellerApprove(Number(escrowId));
  await tx.wait();

  console.log(`✅ Seller approved on-chain. TxHash: ${tx.hash}`);
  return tx.hash;
};

// ── GOVERNMENT APPROVAL: Final step — triggers NFT transfer automatically ─────
// Government signs in MetaMask
// After this: NFT moves seller → buyer, ETH moves contract → seller
// This is the step that appears on Sepolia Etherscan
export const governmentApproveOnChain = async (escrowId) => {
  if (!escrowId) throw new Error('escrowId is required for government approval');

  const { transferContract } = await getContracts();

  console.log(`Government approving escrow #${escrowId} on-chain...`);
  console.log(`This will trigger automatic NFT transfer to buyer.`);

  // MetaMask popup for government wallet
  const tx = await transferContract.governmentApprove(Number(escrowId));
  await tx.wait();

  console.log(`✅ Government approved on-chain. NFT transferred! TxHash: ${tx.hash}`);
  return tx.hash;
};

// ── Get escrow details from chain (useful for debugging) ─────────────────────
export const getEscrowDetails = async (escrowId) => {
  try {
    const { transferContract } = await getContracts();
    const escrow = await transferContract.escrows(Number(escrowId));
    return {
      escrowId:      escrow.escrowId.toString(),
      tokenId:       escrow.tokenId.toString(),
      seller:        escrow.seller,
      buyer:         escrow.buyer,
      price:         ethers.formatEther(escrow.price),
      status:        Number(escrow.status),
      sellerApproved: escrow.sellerApproved,
      buyerApproved:  escrow.buyerApproved,
      govApproved:    escrow.govApproved,
    };
  } catch (err) {
    console.error('getEscrowDetails failed:', err.message);
    return null;
  }
};

// ── Get NFT owner from chain (verify transfer happened) ──────────────────────
export const getNFTOwner = async (tokenId) => {
  try {
    const { landRegistry } = await getContracts();
    return await landRegistry.ownerOf(tokenId);
  } catch (err) {
    console.error('getNFTOwner failed:', err.message);
    return null;
  }
};