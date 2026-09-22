const LandParcel = require("../models/LandParcel");
const VerificationLog = require("../models/VerificationLog");
const mlService = require("../services/mlService");

// @route   POST /api/verify/:parcelId  — manually trigger verification
const triggerVerification = async (req, res, next) => {
  try {
    if (req.user.role !== "government") {
      return res.status(403).json({
        success: false,
        message: "Only government authority can trigger re-verification",
      });
    }
    const parcel = await LandParcel.findById(req.params.parcelId);
    if (!parcel)
      return res
        .status(404)
        .json({ success: false, message: "Parcel not found" });

    const result = await mlService.verifyParcel(parcel._id, parcel.centerPoint);

    res.status(200).json({
      success: true,
      message: "Verification triggered",
      result,
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/verify/:parcelId/logs
const getVerificationLogs = async (req, res, next) => {
  try {
    const logs = await VerificationLog.find({ parcel: req.params.parcelId })
      .sort({ createdAt: -1 })
      .limit(10);
    res.status(200).json({ success: true, logs });
  } catch (error) {
    next(error);
  }
};

module.exports = { triggerVerification, getVerificationLogs };
