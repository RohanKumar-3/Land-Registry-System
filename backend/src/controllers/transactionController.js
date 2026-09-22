const Transaction = require('../models/Transaction');
const LandParcel  = require('../models/LandParcel');
const User        = require('../models/User');

// @route  POST /api/transactions/initiate
// @desc   Buyer initiates purchase — creates escrow record in DB
const initiatePurchase = async (req, res, next) => {
  try {
    console.log('initiatePurchase req.body:', req.body);
    console.log('initiatePurchase user:', req.user?.role, req.user?._id);
    const { parcelId, offeredPrice,escrowId, txHash } = req.body;

    // ── Validate parcel ──────────────────────────────────────────────────
    const parcel = await LandParcel.findById(parcelId)
      .populate('owner', 'name email walletAddress');

      console.log('parcel found:', !!parcel);
    console.log('parcel.isListed:', parcel?.isListed);
    console.log('parcel.status:', parcel?.status);
    console.log('parcel.owner._id:', parcel?.owner?._id?.toString());
    console.log('req.user._id:', req.user._id.toString());
    console.log('same owner?:', parcel?.owner?._id?.toString() === req.user._id.toString());

    if (!parcel) {
      return res.status(404).json({
        success: false, message: 'Parcel not found'
      });
    }
    if (!parcel.isListed) {
      return res.status(400).json({
        success: false, message: 'Parcel is not listed for sale'
      });
    }
    if (parcel.owner._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false, message: 'Cannot buy your own parcel'
      });
    }
    if (parcel.status === 'under_transfer') {
      return res.status(400).json({
        success: false, message: 'Parcel already under transfer'
      });
    }

    console.log('Attempting Transaction.create...');

    // ── Create transaction record ────────────────────────────────────────
    const transaction = await Transaction.create({
      parcel:       parcelId,
      seller:       parcel.owner._id,
      buyer:        req.user._id,
      price:        offeredPrice || parcel.listingPrice,
      escrowStatus: 'funded',
      buyerApproved: true,
      contractEscrowId: escrowId || null, // ← save on-chain escrow ID
      blockchainTxHash: txHash  || null,
    });

console.log('Transaction created:', transaction._id);

    // Mark parcel as under transfer
    await LandParcel.findByIdAndUpdate(parcelId, {
      status: 'under_transfer'
    });

    const populated = await Transaction.findById(transaction._id)
      .populate('parcel',  'title parcelId tokenId')
      .populate('seller',  'name email walletAddress')
      .populate('buyer',   'name email walletAddress');

    res.status(201).json({
      success: true,
      message: 'Purchase initiated! Complete payment on blockchain.',
      transaction: populated
    });
  } catch (error) {
    next(error);
  }
};

// @route  PUT /api/transactions/:id/seller-approve
const sellerApprove = async (req, res, next) => {
  try {
    const txn = await Transaction.findById(req.params.id)
      .populate('seller', 'name email');

    if (!txn) {
      return res.status(404).json({
        success: false, message: 'Transaction not found'
      });
    }
    if (txn.seller._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false, message: 'Only seller can approve'
      });
    }
    if (txn.sellerApproved) {
      return res.status(400).json({ success: false, message: 'Already approved' });
    }

    const txHash = req.body?.txHash || null;
    txn.sellerApproved   = true;
    txn.escrowStatus     = 'seller_approved';
    if (txHash) txn.blockchainTxHash = txHash;
    await txn.save();

    res.status(200).json({
      success: true,
      message: 'Seller approved the sale',
      transaction: txn
    });
  } catch (error) {
    next(error);
  }
};

// @route  PUT /api/transactions/:id/government-approve
const governmentApproveTransaction = async (req, res, next) => {
  try {
    const txn = await Transaction.findById(req.params.id)
      .populate('parcel')
      .populate('seller', 'name email walletAddress')
      .populate('buyer',  'name email walletAddress');

    if (!txn) {
      return res.status(404).json({
        success: false, message: 'Transaction not found'
      });
    }
     if (txn.governmentApproved) {
      return res.status(400).json({ success: false, message: 'Already approved' });
    }
     const txHash = req.body?.txHash || null;
    txn.governmentApproved = true;
    txn.escrowStatus       = 'completed';
    txn.completedAt        = new Date();
    if (txHash) txn.blockchainTxHash = txHash;
    await txn.save();

    // If all 3 parties approved → mark as completed in DB
    // (actual NFT transfer happens on blockchain via smart contract)
    if (txn.sellerApproved && txn.buyerApproved && txn.governmentApproved) {
      txn.escrowStatus = 'completed';
      txn.completedAt  = new Date();
      await txn.save();

        // ── Transfer NFT on blockchain ─────────────────────────────
      try {
        const blockchainService = require('../services/blockchainService');
        const buyerWallet  = txn.buyer.walletAddress;
        const tokenId      = txn.parcel.tokenId;

        if (tokenId && buyerWallet) {
          const transferTxHash = await blockchainService.transferNFT(
            tokenId,
            buyerWallet
          );
          console.log(`✅ NFT transferred: tokenId=${tokenId} → ${buyerWallet}`);
          console.log(`   Tx: ${transferTxHash}`);

          txn.blockchainTxHash = transferTxHash;
          await txn.save();
        }
      } catch (chainErr) {
        console.error('⚠️  NFT transfer failed:', chainErr.message);
        // Don't fail the request — DB ownership already updated
      }

      // Update parcel ownership in MongoDB
      await LandParcel.findByIdAndUpdate(txn.parcel._id, {
      owner:    txn.buyer._id,
      status:   'active',
      isListed: false,
      $push: {
        previousOwners: {
          user:          txn.seller._id,
          transferredAt: new Date(),
        }
      }
    });

    console.log(`✅ DB ownership updated — NFT already on Sepolia`);

    res.status(200).json({
      success: true,
      message: 'Transfer complete! NFT moved to buyer on Sepolia.',
      transaction: txn,
    });
  }}catch (error) {
    next(error);
  }
};

// @route  PUT /api/transactions/:id/cancel
const cancelTransaction = async (req, res, next) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn) {
      return res.status(404).json({
        success: false, message: 'Transaction not found'
      });
    }

    const isParty =
      txn.buyer.toString()  === req.user._id.toString() ||
      txn.seller.toString() === req.user._id.toString() ||
      req.user.role         === 'government';

    if (!isParty) {
      return res.status(403).json({
        success: false, message: 'Not authorized'
      });
    }

    txn.escrowStatus = 'cancelled';
    await txn.save();

    // Free the parcel
    await LandParcel.findByIdAndUpdate(txn.parcel, {
      status: 'listed'
    });

    res.status(200).json({
      success: true,
      message: 'Transaction cancelled',
      transaction: txn
    });
  } catch (error) {
    next(error);
  }
};

// @route  GET /api/transactions/my
const getMyTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({
      $or: [
        { buyer:  req.user._id },
        { seller: req.user._id }
      ]
    })
      .populate('parcel',  'title parcelId tokenId areaInSqMeters landType')
      .populate('seller',  'name email walletAddress')
      .populate('buyer',   'name email walletAddress')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (error) {
    next(error);
  }
};

// @route  GET /api/transactions/pending  (government)
const getPendingTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({
      // Show anything not completed or cancelled
      escrowStatus: { $nin: ['completed', 'cancelled'] },
      governmentApproved: false,
    })
      .populate('parcel',  'title parcelId tokenId')
      .populate('seller',  'name email walletAddress')
      .populate('buyer',   'name email walletAddress')
      .sort({ createdAt: -1 });

    console.log(`📋 Pending transactions found: ${transactions.length}`);
    transactions.forEach(t => {
      console.log(`   ${t._id} | escrowStatus: ${t.escrowStatus} | sellerApproved: ${t.sellerApproved} | contractEscrowId: ${t.contractEscrowId}`);
    });

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

// @route  PUT /api/transactions/:id/blockchain-update
// @desc   Called after blockchain tx completes to sync DB
const updateBlockchainTx = async (req, res, next) => {
  try {
    const { txHash, escrowId } = req.body;
    const txn = await Transaction.findByIdAndUpdate(
      req.params.id,
      {
        blockchainTxHash: txHash,
        contractAddress:  escrowId,
        escrowStatus:     'funded',
      },
      { new: true }
    );
    res.status(200).json({ success: true, transaction: txn });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiatePurchase,
  sellerApprove,
  governmentApproveTransaction,
  cancelTransaction,
  getMyTransactions,
  getPendingTransactions,
  updateBlockchainTx,
};