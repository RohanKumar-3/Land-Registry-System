const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
    default: () => 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
  },
  parcel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandParcel',
    required: true
  },
  contractEscrowId: {
  type:    String,
  default: null,
  // escrow ID from TransferContract.sol — used for on-chain lookups
},
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  price: { type: Number, required: true },
  currency: { type: String, default: 'ETH' },

  // Smart contract
  contractAddress: { type: String },
  blockchainTxHash: { type: String },
  escrowStatus: {
    type: String,
    enum: ['initiated', 'funded', 'approved' ,'seller_approved', 'completed', 'cancelled', 'disputed'],
    default: 'initiated'
  },

  // Approvals (multi-sig)
  sellerApproved: { type: Boolean, default: false },
  buyerApproved: { type: Boolean, default: false },
  governmentApproved: { type: Boolean, default: false },

  completedAt: { type: Date },
  notes: { type: String }
}, { timestamps: true });


module.exports = mongoose.model('Transaction', transactionSchema);