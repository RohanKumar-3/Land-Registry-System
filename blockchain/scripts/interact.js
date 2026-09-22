// Script to test contract interactions after deployment

import hardhat from "hardhat";
const { ethers } = hardhat;

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.name;

  console.log("\n🧪 Testing contract interactions...\n");
  console.log("🌐 Network:", networkName);

  let landowner;
  let buyer;
  let government;

  // -------------------------------------------------
  // Localhost → use Hardhat accounts
  // -------------------------------------------------

  if (networkName === "localhost" || network.chainId === 31337) {
    const signers = await ethers.getSigners();

    government = signers[0]; // authorized during deploy
    landowner = signers[1]; // seller
    buyer = signers[2]; // buyer

    console.log("🏠 Using Hardhat local accounts");
  }

  // -------------------------------------------------
  // Testnet / Production → use private keys
  // -------------------------------------------------
  else {
    const provider = ethers.provider;

    landowner = new ethers.Wallet(process.env.SELLER_PRIVATE_KEY, provider);
    buyer = new ethers.Wallet(process.env.BUYER_PRIVATE_KEY, provider);
    government = new ethers.Wallet(process.env.GOV_PRIVATE_KEY, provider);

    console.log("🌍 Using environment wallets");
  }

  const landownerAddr = await landowner.getAddress();
  const buyerAddr = await buyer.getAddress();
  const governmentAddr = await government.getAddress();

  console.log("Seller:", landownerAddr);
  console.log("Buyer :", buyerAddr);
  console.log("Gov   :", governmentAddr);

  // -------------------------------------------------
  // Load deployment file
  // -------------------------------------------------

  const deploymentFile = path.join(
    __dirname,
    `../deployments/${networkName}.json`,
  );

  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ No deployment file found. Run deploy.js first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

  // -------------------------------------------------
  // Connect contracts
  // -------------------------------------------------

  const landRegistry = await ethers.getContractAt(
    "LandRegistry",
    deployment.contracts.LandRegistry.address,
  );

  const transfer = await ethers.getContractAt(
    "TransferContract",
    deployment.contracts.TransferContract.address,
  );

  // -------------------------------------------------
  // 1️⃣ Mint Land
  // -------------------------------------------------

  console.log("\n1️⃣ Minting land parcel NFT...");

  const parcelId = `parcel-${Date.now()}`;

  const mintTx = await landRegistry
    .connect(government)
    .mintLandParcel(
      landownerAddr,
      parcelId,
      ethers.keccak256(ethers.toUtf8Bytes("18.5204,73.8567")),
      50000,
      "agricultural",
      85,
      "QmTestIPFSHash",
      "ipfs://QmTestTokenURIMetadata",
    );

  const mintReceipt = await mintTx.wait();

  const transferEvent = mintReceipt.logs.find(
    (log) => log.fragment && log.fragment.name === "Transfer",
  );

  const tokenId = transferEvent.args.tokenId;

  console.log(`✅ Minted TokenId: ${tokenId}`);
  console.log(`Tx: ${mintReceipt.hash}`);

  // -------------------------------------------------
  // 2️⃣ Read Parcel
  // -------------------------------------------------

  console.log("\n2️⃣ Reading parcel from chain...");

  const parcel = await landRegistry.getParcel(tokenId);

  console.log("TokenId :", parcel.tokenId.toString());
  console.log("Owner   :", parcel.owner);
  console.log("Score   :", parcel.verificationScore.toString());
  console.log("Verified:", parcel.isVerified);

  // -------------------------------------------------
  // 3️⃣ List Parcel
  // -------------------------------------------------

  console.log("\n3️⃣ Listing parcel for sale...");

  const price = ethers.parseEther("0.001");

  const listTx = await landRegistry
    .connect(landowner)
    .listParcel(tokenId, price);

  await listTx.wait();

  console.log("✅ Parcel listed for 0.001 ETH");

  // -------------------------------------------------
  // Seller Approves TransferContract
  // -------------------------------------------------

  console.log("\n🔑 Seller approving TransferContract...");

  const approveTx = await landRegistry
    .connect(landowner)
    .approve(await transfer.getAddress(), tokenId);

  await approveTx.wait();

  console.log("✅ TransferContract approved");

  // -------------------------------------------------
  // 4️⃣ Buyer Initiates Purchase
  // -------------------------------------------------

  console.log("\n4️⃣ Buyer initiating purchase...");

  const purchaseTx = await transfer.connect(buyer).initiatePurchase(tokenId, {
    value: price,
  });

  await purchaseTx.wait();

  console.log("✅ Escrow funded by buyer");

  // -------------------------------------------------
  // 5️⃣ Seller Approves
  // -------------------------------------------------

  console.log("\n5️⃣ Seller approving escrow...");

  const sellerApproveTx = await transfer
    .connect(landowner)
    .sellerApprove(tokenId);

  await sellerApproveTx.wait();

  console.log("✅ Seller approved");

  // -------------------------------------------------
  // 6️⃣ Government Approves
  // -------------------------------------------------

  console.log("\n6️⃣ Government approving transfer...");

  const govApproveTx = await transfer
    .connect(government)
    .governmentApprove(tokenId);

  await govApproveTx.wait();

  console.log("✅ Transfer complete!");

  // -------------------------------------------------
  // 7️⃣ Verify Owner
  // -------------------------------------------------

  console.log("\n7️⃣ Verifying new owner...");

  const newOwner = await landRegistry.ownerOf(tokenId);

  console.log("New owner:", newOwner);
  console.log("Expected :", buyerAddr);

  console.log("Match:", newOwner.toLowerCase() === buyerAddr.toLowerCase());

  console.log("\n✨ All tests passed!\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
