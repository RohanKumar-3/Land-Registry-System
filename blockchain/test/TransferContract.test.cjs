const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("TransferContract", function () {
  async function deployFixture() {
    const [owner, landowner, buyer, other] = await ethers.getSigners();

    const LandRegistry = await ethers.getContractFactory("LandRegistry");
    const registry = await LandRegistry.deploy();

    const TransferContract = await ethers.getContractFactory(
      "TransferContract",
    );
    const transfer = await TransferContract.deploy(await registry.getAddress());

    // Authorize TransferContract
    await registry.addGovernmentAuthority(await transfer.getAddress());

    // Mint a parcel to landowner (score 80 → verified → can be listed)
    await registry.mintLandParcel(
      landowner.address,
      "parcel-escrow-001",
      ethers.keccak256(ethers.toUtf8Bytes("20.5,78.9")),
      10000,
      "agricultural",
      80,
      "QmIPFSHash",
      "ipfs://QmMetadata",
    );

    // List parcel for 0.5 ETH
    await registry.connect(landowner).listParcel(1, ethers.parseEther("0.5"));

    return { registry, transfer, owner, landowner, buyer, other };
  }

  describe("Purchase Flow", function () {
    it("Should initiate escrow with correct data", async function () {
      const { transfer, landowner, buyer } = await loadFixture(deployFixture);

      await transfer.connect(buyer).initiatePurchase(1, {
        value: ethers.parseEther("0.5"),
      });

      const escrow = await transfer.escrows(1);
      expect(escrow.buyer).to.equal(buyer.address);
      expect(escrow.seller).to.equal(landowner.address);
      expect(escrow.price).to.equal(ethers.parseEther("0.5"));
    });

    it("Should complete full 3-party transfer flow", async function () {
      const { registry, transfer, owner, landowner, buyer } = await loadFixture(
        deployFixture,
      );
       // Seller approves transfer contract to move NFT
      await registry.connect(landowner).approve(await transfer.getAddress(), 1);

      // Track seller balance before
      const sellerBalanceBefore = await ethers.provider.getBalance(
        landowner.address,
      );

      // Buyer funds escrow
      await transfer.connect(buyer).initiatePurchase(1, {
        value: ethers.parseEther("0.5"),
      });

      // Seller approves
      await transfer.connect(landowner).sellerApprove(1);

      // Government approves → auto completes
      await expect(transfer.connect(owner).governmentApprove(1)).to.emit(
        transfer,
        "EscrowCompleted",
      );

      // NFT ownership changed
      expect(await registry.ownerOf(1)).to.equal(buyer.address);

      // Seller received ETH (minus 1% fee)
      const sellerBalanceAfter = await ethers.provider.getBalance(
        landowner.address,
      );
      expect(sellerBalanceAfter).to.be.gt(sellerBalanceBefore);
    });

    it("Should allow buyer to cancel and get refund", async function () {
      const { transfer, buyer } = await loadFixture(deployFixture);

      await transfer.connect(buyer).initiatePurchase(1, {
        value: ethers.parseEther("0.5"),
      });

      const buyerBalanceBefore = await ethers.provider.getBalance(
        buyer.address,
      );

      await transfer.connect(buyer).cancelEscrow(1);

      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      expect(buyerBalanceAfter).to.be.gt(buyerBalanceBefore);
    });
  });
});
