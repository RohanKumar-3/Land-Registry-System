const LandParcel = require("../models/LandParcel");
const VerificationLog = require("../models/VerificationLog");
const { paginate } = require("../utils/helpers");
const mlService = require("../services/mlService");
const ipfsService = require("../services/ipfsService");

// @route   POST /api/lands/register
const registerLand = async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      boundaries,
      centerPoint,
      areaInSqMeters,
      landType,
      listingPrice,
    } = req.body;

    if (!req.user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Please connect your MetaMask wallet before registering land",
      });
    }

    let documents = [];

    // Upload documents to IPFS if provided
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ipfsHash = await ipfsService.uploadFile(
          file.buffer,
          file.originalname,
        );

        documents.push({
          name: file.originalname,
          ipfsHash,
        });
      }
    }

    const parsedLocation =
      typeof location === "string" ? JSON.parse(location) : location;

    const parsedBoundaries =
      typeof boundaries === "string" ? JSON.parse(boundaries) : boundaries;

    const parsedCenterPoint =
      typeof centerPoint === "string" ? JSON.parse(centerPoint) : centerPoint;

    const parcel = await LandParcel.create({
      title,
      description,
      owner: req.user._id,
      location: parsedLocation,
      boundaries: parsedBoundaries,
      centerPoint: parsedCenterPoint,
      areaInSqMeters,
      landType,
      listingPrice,
      documents,
    });

    // Trigger ML verification asynchronously
    if (parsedCenterPoint) {
      mlService
        .verifyParcel(parcel._id, parsedCenterPoint)
        .catch((err) => console.error("ML verification error:", err.message));
    }

    res.status(201).json({
      success: true,
      message: "Land parcel registered. ML verification initiated.",
      parcel,
    });
  } catch (error) {
    console.error("Register land error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @route   GET /api/lands
const getAllLands = async (req, res) => {
  try {
    const { page, limit, landType, status, district, search } = req.query;
    const { skip, limit: lim } = paginate(page, limit);

    const query = {};

    if (landType) query.landType = landType;
    if (status) query.status = status;
    if (district) query["location.district"] = district;
    if (search) query.title = { $regex: search, $options: "i" };

    const [parcels, total] = await Promise.all([
      LandParcel.find(query)
        .populate("owner", "name email walletAddress")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim),

      LandParcel.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: parcels.length,
      total,
      totalPages: Math.ceil(total / lim),
      currentPage: parseInt(page) || 1,
      parcels,
    });
  } catch (error) {
    console.error("Get lands error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @route   GET /api/lands/:id
const getLandById = async (req, res) => {
  try {
    const parcel = await LandParcel.findById(req.params.id)
      .populate("owner", "name email walletAddress phone")
      .populate("previousOwners.user", "name email")
      .populate("approvedBy", "name email");

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Land parcel not found",
      });
    }

    res.status(200).json({
      success: true,
      parcel,
    });
  } catch (error) {
    console.error("Get land by ID error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @route   GET /api/lands/my-parcels
const getMyParcels = async (req, res) => {
  try {
    const parcels = await LandParcel.find({
      owner: req.user._id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: parcels.length,
      parcels,
    });
  } catch (error) {
    console.error("Get my parcels error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @route   PUT /api/lands/:id
const updateLand = async (req, res) => {
  try {
    const parcel = await LandParcel.findById(req.params.id);

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found",
      });
    }

    if (parcel.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    const updated = await LandParcel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      message: "Parcel updated",
      parcel: updated,
    });
  } catch (error) {
    console.error("Update land error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @route   PUT /api/lands/:id/list
// @route   PUT /api/lands/:id/list
// @desc    Landowner lists approved parcel for sale
// @access  Private (landowner only)
const listForSale = async (req, res, next) => {
  try {
    const { listingPrice } = req.body;

    if (!listingPrice || Number(listingPrice) <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Enter a valid price in ETH" });
    }

    const parcel = await LandParcel.findById(req.params.id);

    if (!parcel)
      return res
        .status(404)
        .json({ success: false, message: "Parcel not found" });
    if (parcel.owner.toString() !== req.user._id.toString())
      return res
        .status(403)
        .json({ success: false, message: "Not your parcel" });
    if (!parcel.governmentApproved)
      return res
        .status(400)
        .json({
          success: false,
          message: "Parcel must be government-approved first",
        });
    if (!req.user.walletAddress)
      return res
        .status(400)
        .json({ success: false, message: "Connect MetaMask wallet first" });
    if (parcel.isListed)
      return res
        .status(400)
        .json({ success: false, message: "Already listed" });

    // Save to MongoDB first
    parcel.isListed = true;
    parcel.listingPrice = Number(listingPrice);
    parcel.status = "listed";
    await parcel.save();

    // Also mark on blockchain (non-blocking — won't fail the request)
    if (parcel.tokenId) {
      const blockchainService = require("../services/blockchainService");
      blockchainService
        .listParcelOnChain(parcel.tokenId, listingPrice)
        .catch((err) =>
          console.warn("⚠️  On-chain listing failed:", err.message),
        );
    }

    res.json({ success: true, message: "Parcel listed for sale!", parcel });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/lands/:id/government-approve
// @route   PUT /api/lands/:id/government-approve
const governmentApprove = async (req, res, next) => {
  try {
    const parcel = await LandParcel.findById(req.params.id).populate(
      "owner",
      "name email walletAddress",
    );

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found",
      });
    }

    // ── Update MongoDB ───────────────────────────────────────────────────
    parcel.governmentApproved = true;
    parcel.approvedBy = req.user._id;
    parcel.approvedAt = new Date();
    parcel.verificationStatus = "verified";
    await parcel.save();

    // ── Mint NFT on blockchain ───────────────────────────────────────────
    // Only mint if:
    // 1. Owner has a wallet address
    // 2. Not already on chain
    // 3. Blockchain service is configured
    if (!parcel.isOnChain && parcel.owner?.walletAddress) {
      try {
        console.log(`⛓️  Minting NFT for approved parcel: ${parcel._id}`);

        const blockchainService = require("../services/blockchainService");
        const { tokenId, txHash } = await blockchainService.mintLandNFT(
          parcel._id.toString(),
          parcel.owner.walletAddress,
          parcel.centerPoint || { lat: 0, lng: 0 },
          parcel.areaInSqMeters,
          parcel.landType,
          parcel.verificationScore || 0,
          parcel.ipfsDocumentHash || "",
        );

        // Update parcel with blockchain info
        if (tokenId) {
          parcel.tokenId = tokenId;
          parcel.blockchainTxHash = txHash;
          parcel.isOnChain = true;
          await parcel.save();
          console.log(`✅ NFT minted: tokenId=${tokenId}`);
        }
      } catch (chainErr) {
        // Don't fail the whole request if blockchain fails
        // Government approval is still saved in MongoDB
        console.error("⚠️  NFT minting failed:", chainErr.message);
        console.error("    Approval saved in DB but NFT not minted");
      }
    } else if (!parcel.owner?.walletAddress) {
      console.warn("⚠️  Owner has no wallet address — NFT not minted");
      console.warn("    Owner must connect MetaMask wallet first");
    }

    // Reload parcel with updated blockchain info
    const updatedParcel = await LandParcel.findById(req.params.id)
      .populate("owner", "name email walletAddress")
      .populate("approvedBy", "name email");

    res.status(200).json({
      success: true,
      message: parcel.isOnChain
        ? "Parcel approved and NFT minted on blockchain!"
        : "Parcel approved (connect wallet to mint NFT)",
      parcel: updatedParcel,
    });
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/lands/:id
const deleteLand = async (req, res) => {
  try {
    const parcel = await LandParcel.findById(req.params.id);

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found",
      });
    }

    if (
      parcel.owner.toString() !== req.user._id.toString() &&
      req.user.role !== "government"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    await parcel.deleteOne();

    res.status(200).json({
      success: true,
      message: "Parcel deleted",
    });
  } catch (error) {
    console.error("Delete parcel error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  registerLand,
  getAllLands,
  getLandById,
  getMyParcels,
  updateLand,
  listForSale,
  governmentApprove,
  deleteLand,
};
