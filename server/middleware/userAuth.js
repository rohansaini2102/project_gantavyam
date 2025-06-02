const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protectUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access denied. Token missing.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

module.exports = protectUser;
