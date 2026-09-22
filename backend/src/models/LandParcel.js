const mongoose = require("mongoose");

const coordinateSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
);

const landParcelSchema = new mongoose.Schema(
  {
    parcelId: {
      type: String,
      unique: true,
      default: () =>
        "LP-" +
        Date.now() +
        "-" +
        Math.random().toString(36).substr(2, 5).toUpperCase(),
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: { type: String, trim: true },

    // Owner info
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    previousOwners: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        transferredAt: { type: Date },
      },
    ],

    // Location
    location: {
      state: { type: String, required: true },
      district: { type: String, required: true },
      village: { type: String },
      pincode: { type: String },
      fullAddress: { type: String },
    },

    // Boundary coordinates (polygon on map)
    boundaries: {
      type: [[Number]], // [[lng, lat], [lng, lat], ...]
      required: true,
    },
    centerPoint: coordinateSchema,
    areaInSqMeters: { type: Number, required: true },

    // Land type
    landType: {
      type: String,
      enum: [
        "agricultural",
        "residential",
        "commercial",
        "industrial",
        "forest",
        "wasteland",
      ],
      required: true,
    },

    // Blockchain info
    tokenId: { type: String, unique: true, sparse: true },
    blockchainTxHash: { type: String },
    ipfsDocumentHash: { type: String },
    isOnChain: { type: Boolean, default: false },

    // Documents
    documents: [
      {
        name: { type: String },
        ipfsHash: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // ML Verification
    verificationScore: { type: Number, min: 0, max: 100, default: null },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected", "flagged"],
      default: "pending",
    },
    lastVerifiedAt: { type: Date },
    verificationNotes: { type: String },
    satelliteImageUrl: { type: String },

    // Status
    status: {
      type: String,
      enum: ["active", "listed", "under_transfer", "disputed"],
      default: "active",
    },
    isListed: { type: Boolean, default: false },
    listingPrice: { type: Number },

    // Government approval
    governmentApproved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true },
);

// Auto-generate parcelId
// landParcelSchema.pre("save", function (next) {
//   if (!this.parcelId) {
//     this.parcelId =
//       "LP-" +
//       Date.now() +
//       "-" +
//       Math.random().toString(36).substr(2, 5).toUpperCase();
//   }
//   next();
// });

module.exports = mongoose.model("LandParcel", landParcelSchema);
