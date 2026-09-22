const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  res.status(statusCode).json({
    success: true,
    token,
    expiresIn: 45 * 60,   // 45 minutes in seconds — sent to frontend
    user: {
      _id:          user._id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
      walletAddress:user.walletAddress,
    }
  });
};