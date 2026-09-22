const axios = require("axios");
const LandParcel = require("../models/LandParcel");
const VerificationLog = require("../models/VerificationLog");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const verifyParcel = async (parcelId, centerPoint) => {
  const log = await VerificationLog.create({
    parcel: parcelId,
    triggeredBy: "registration",
    status: "pending",
  });

  try {
    const response = await axios.post(`${ML_SERVICE_URL}/verify`, {
      parcel_id: parcelId.toString(),
      lat: centerPoint.lat,
      lng: centerPoint.lng,
    });

    const {
      score,
      detected_land_type,
      encroachment_detected,
      boundary_mismatch,
      satellite_image_url,
    } = response.data;

    const parcel = await LandParcel.findById(parcelId);
    const previousScore = parcel.verificationScore;

    parcel.verificationScore = score;
    parcel.lastVerifiedAt = new Date();
    parcel.satelliteImageUrl = satellite_image_url;
    parcel.verificationStatus =
      score >= 70 ? "verified" : score >= 40 ? "pending" : "flagged";

    await parcel.save();

    log.score = score;
    log.previousScore = previousScore;
    log.status = "success";
    log.satelliteImageUrl = satellite_image_url;
    log.detectedLandType = detected_land_type;
    log.encroachmentDetected = encroachment_detected;
    log.boundaryMismatch = boundary_mismatch;
    log.rawMLResponse = response.data;

    await log.save();

    return response.data;
  } catch (error) {
    log.status = "failed";
    log.notes = error.message;
    await log.save();
    throw error;
  }
};

// 🟢 Health check function
const checkHealth = async () => {
  try {
    const res = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 5000 });

    if (res.data && res.data.status) {
      console.log("✅ ML Service connected");
      return true;
    }

    return false;
  } catch (err) {
    console.warn("ML health check failed:", err.message);
    return false;
  }
};

module.exports = {
  verifyParcel,
  checkHealth,
};
