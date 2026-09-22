const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Send token response
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = generateToken(user._id);

  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    walletAddress: user.walletAddress,
    isVerified: user.isVerified,
    avatar: user.avatar
  };

  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: userResponse
  });
};

// Paginate results
const paginate = (page = 1, limit = 10) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  return { skip, limit: parseInt(limit) };
};

module.exports = { generateToken, sendTokenResponse, paginate };