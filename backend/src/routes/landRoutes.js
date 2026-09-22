const express = require('express');
const router = express.Router();
const {
  registerLand, getAllLands, getLandById,
  getMyParcels, updateLand, listForSale,
  governmentApprove, deleteLand
} = require('../controllers/landController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../config/multer');

router.get('/', getAllLands);
router.get('/my-parcels', protect, getMyParcels);
router.get('/:id', getLandById);
router.post('/register', protect, upload.array('documents', 5), registerLand);
router.put('/:id', protect, updateLand);
router.put('/:id/list', protect, authorize('landowner'), listForSale);
router.put('/:id/government-approve', protect, authorize('government'), governmentApprove);
router.delete('/:id', protect, deleteLand);

module.exports = router;