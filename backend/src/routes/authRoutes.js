const express = require('express');
const router = express.Router();
const { register, login, getMe, updateWallet, logout } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/update-wallet', protect, updateWallet);

module.exports = router;