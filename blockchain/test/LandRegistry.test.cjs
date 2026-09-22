const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe('LandRegistry', function () {

  // ── Fixture: deploy fresh contract before each test ──────────────────────
  async function deployFixture() {
    const [owner, gov2, landowner, buyer, other] = await ethers.getSigners();

    const LandRegistry = await ethers.getContractFactory('LandRegistry');
    const registry     = await LandRegistry.deploy();

    return { registry, owner, gov2, landowner, buyer, other };
  }

  const SAMPLE_PARCEL = {
    parcelId:     'parcel-001',
    locationHash: ethers.keccak256(ethers.toUtf8Bytes('20.5937,78.9629')),
    area:         10000,
    landType:     'agricultural',
    score:        80,
    ipfsHash:     'QmSampleIPFSHash',
    tokenURI:     'ipfs://QmSampleMetadata',
  };

  // ── Deployment ─────────────────────────────────────────────────────────
  describe('Deployment', function () {
    it('Should set the correct name and symbol', async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.name()).to.equal('LandChain Registry');
      expect(await registry.symbol()).to.equal('LAND');
    });

    it('Should set deployer as owner and government authority', async function () {
      const { registry, owner } = await loadFixture(deployFixture);
      expect(await registry.owner()).to.equal(owner.address);
      expect(await registry.isGovernmentAuthority(owner.address)).to.be.true;
    });

    it('Should start with 0 parcels', async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.totalParcels()).to.equal(0);
    });
  });

  // ── Minting ────────────────────────────────────────────────────────────
  describe('Minting', function () {
    it('Should mint land parcel correctly', async function () {
      const { registry, owner, landowner } = await loadFixture(deployFixture);

      await expect(
        registry.mintLandParcel(
          landowner.address,
          SAMPLE_PARCEL.parcelId,
          SAMPLE_PARCEL.locationHash,
          SAMPLE_PARCEL.area,
          SAMPLE_PARCEL.landType,
          SAMPLE_PARCEL.score,
          SAMPLE_PARCEL.ipfsHash,
          SAMPLE_PARCEL.tokenURI
        )
      ).to.emit(registry, 'ParcelMinted')
        .withArgs(1, SAMPLE_PARCEL.parcelId, landowner.address, SAMPLE_PARCEL.area, SAMPLE_PARCEL.landType);

      expect(await registry.ownerOf(1)).to.equal(landowner.address);
      expect(await registry.totalParcels()).to.equal(1);
    });

    it('Should store parcel data correctly', async function () {
      const { registry, landowner } = await loadFixture(deployFixture);

      await registry.mintLandParcel(
        landowner.address,
        SAMPLE_PARCEL.parcelId,
        SAMPLE_PARCEL.locationHash,
        SAMPLE_PARCEL.area,
        SAMPLE_PARCEL.landType,
        SAMPLE_PARCEL.score,
        SAMPLE_PARCEL.ipfsHash,
        SAMPLE_PARCEL.tokenURI
      );

      const parcel = await registry.getParcel(1);
      expect(parcel.parcelId).to.equal(SAMPLE_PARCEL.parcelId);
      expect(parcel.areaInSqMeters).to.equal(SAMPLE_PARCEL.area);
      expect(parcel.verificationScore).to.equal(SAMPLE_PARCEL.score);
      expect(parcel.isVerified).to.be.true; // score >= 70
    });

    it('Should reject duplicate parcel ID', async function () {
      const { registry, landowner } = await loadFixture(deployFixture);

      await registry.mintLandParcel(
        landowner.address, SAMPLE_PARCEL.parcelId, SAMPLE_PARCEL.locationHash,
        SAMPLE_PARCEL.area, SAMPLE_PARCEL.landType, SAMPLE_PARCEL.score,
        SAMPLE_PARCEL.ipfsHash, SAMPLE_PARCEL.tokenURI
      );

      await expect(
        registry.mintLandParcel(
          landowner.address, SAMPLE_PARCEL.parcelId, SAMPLE_PARCEL.locationHash,
          SAMPLE_PARCEL.area, SAMPLE_PARCEL.landType, SAMPLE_PARCEL.score,
          SAMPLE_PARCEL.ipfsHash, SAMPLE_PARCEL.tokenURI
        )
      ).to.be.revertedWith("Parcel already registered");
    });

    it('Should reject minting from non-government address', async function () {
      const { registry, landowner, other } = await loadFixture(deployFixture);

      await expect(
        registry.connect(other).mintLandParcel(
          landowner.address, SAMPLE_PARCEL.parcelId, SAMPLE_PARCEL.locationHash,
          SAMPLE_PARCEL.area, SAMPLE_PARCEL.landType, SAMPLE_PARCEL.score,
          SAMPLE_PARCEL.ipfsHash, SAMPLE_PARCEL.tokenURI
        )
      ).to.be.revertedWith("Not government authority");
    });
  });

  // ── Listing ────────────────────────────────────────────────────────────
  describe('Listing', function () {
    it('Should allow owner to list verified parcel', async function () {
      const { registry, landowner } = await loadFixture(deployFixture);

      await registry.mintLandParcel(
        landowner.address, SAMPLE_PARCEL.parcelId, SAMPLE_PARCEL.locationHash,
        SAMPLE_PARCEL.area, SAMPLE_PARCEL.landType, 80,
        SAMPLE_PARCEL.ipfsHash, SAMPLE_PARCEL.tokenURI
      );

      await expect(
        registry.connect(landowner).listParcel(1, ethers.parseEther('0.5'))
      ).to.emit(registry, 'ParcelListed').withArgs(1, ethers.parseEther('0.5'));

      const parcel = await registry.getParcel(1);
      expect(parcel.isListed).to.be.true;
      expect(parcel.listingPrice).to.equal(ethers.parseEther('0.5'));
    });

    it('Should reject listing unverified parcel', async function () {
      const { registry, landowner } = await loadFixture(deployFixture);

      // Score below 70 → not verified
      await registry.mintLandParcel(
        landowner.address, SAMPLE_PARCEL.parcelId, SAMPLE_PARCEL.locationHash,
        SAMPLE_PARCEL.area, SAMPLE_PARCEL.landType, 50,
        SAMPLE_PARCEL.ipfsHash, SAMPLE_PARCEL.tokenURI
      );

      await expect(
        registry.connect(landowner).listParcel(1, ethers.parseEther('0.5'))
      ).to.be.revertedWith("Parcel not verified");
    });
  });

  // ── Authority Management ───────────────────────────────────────────────
  describe('Authority Management', function () {
    it('Should add new government authority', async function () {
      const { registry, gov2 } = await loadFixture(deployFixture);
      await registry.addGovernmentAuthority(gov2.address);
      expect(await registry.isGovernmentAuthority(gov2.address)).to.be.true;
    });

    it('Should allow new authority to mint', async function () {
      const { registry, gov2, landowner } = await loadFixture(deployFixture);
      await registry.addGovernmentAuthority(gov2.address);

      await expect(
        registry.connect(gov2).mintLandParcel(
          landowner.address, 'parcel-gov2', SAMPLE_PARCEL.locationHash,
          SAMPLE_PARCEL.area, SAMPLE_PARCEL.landType, SAMPLE_PARCEL.score,
          SAMPLE_PARCEL.ipfsHash, SAMPLE_PARCEL.tokenURI
        )
      ).to.not.be.reverted;
    });
  });
});