const express = require('express');
const router = express.Router();
const { triggerVerification, getVerificationLogs } = require('../controllers/verificationController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.post('/:parcelId', protect, authorize('government', 'landowner'), triggerVerification);
router.get('/:parcelId/logs', protect, getVerificationLogs);

module.exports = router;