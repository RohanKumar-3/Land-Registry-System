const mongoose = require('mongoose');

const verificationLogSchema = new mongoose.Schema({
  parcel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandParcel',
    required: true
  },
  triggeredBy: {
    type: String,
    enum: ['manual', 'registration', 'cron'],
    default: 'manual'
  },
  score: { type: Number },
  previousScore: { type: Number },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending'
  },
  satelliteImageUrl: { type: String },
  detectedLandType: { type: String },
  encroachmentDetected: { type: Boolean, default: false },
  boundaryMismatch: { type: Boolean, default: false },
  notes: { type: String },
  rawMLResponse: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('VerificationLog', verificationLogSchema);