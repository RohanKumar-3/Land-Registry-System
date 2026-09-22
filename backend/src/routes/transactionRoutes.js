const express = require('express');
const router  = express.Router();
const {
  initiatePurchase,
  sellerApprove,
  governmentApproveTransaction,
  cancelTransaction,
  getMyTransactions,
  getPendingTransactions,
  updateBlockchainTx,
} = require('../controllers/transactionController');
const { protect }    = require('../middleware/authMiddleware');
const { authorize }  = require('../middleware/roleMiddleware');

router.get( '/my',                protect, getMyTransactions);
router.get( '/pending',           protect, authorize('government'), getPendingTransactions);
router.post('/initiate',          protect, authorize('buyer', 'landowner'), initiatePurchase);
router.put( '/:id/seller-approve',protect, sellerApprove);
router.put( '/:id/gov-approve',   protect, authorize('government'), governmentApproveTransaction);
router.put( '/:id/cancel',        protect, cancelTransaction);
router.put( '/:id/blockchain-update', protect, updateBlockchainTx);

module.exports = router;