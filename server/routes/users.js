// routes/users.js
const express = require('express');
const router = express.Router();
const { registerUser, userLogin } = require('../controllers/userController');
const { protect } = require('../middleware/auth'); // Import the named function
const { uploadProfileImage } = require('../config/cloudinary');
const User = require('../models/User');

router.post('/register', registerUser);
router.post('/login', userLogin);

// Upload profile image
router.post('/profile-image', protect, uploadProfileImage.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Get the user - note that we now use req.driver instead of req.user
    // We could also modify the auth middleware to set req.user for compatibility
    const user = await User.findById(req.driver.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old profile image from Cloudinary if it exists
    if (user.profileImage && user.profileImage.includes('cloudinary.com')) {
      try {
        // Extract public_id from Cloudinary URL
        const urlParts = user.profileImage.split('/');
        const publicIdWithExt = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExt.split('.')[0];
        const folder = urlParts.slice(-3, -1).join('/');
        await require('../config/cloudinary').deleteFromCloudinary(`${folder}/${publicId}`);
        console.log('Old profile image deleted from Cloudinary');
      } catch (error) {
        console.error('Error deleting old profile image from Cloudinary:', error);
      }
    }

    // Get Cloudinary URL
    const cloudinaryUrl = req.file.path || req.file.secure_url;

    // Update user profile with new image URL
    user.profileImage = cloudinaryUrl;
    await user.save();

    console.log('Profile image updated successfully:', {
      cloudinaryUrl,
      publicId: req.file.public_id
    });

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      profileImage: cloudinaryUrl,
      imageUrl: cloudinaryUrl
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading profile image'
    });
  }
});

// Get user profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.driver.id)
      .select('-password')
      .populate('rideHistory');
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
});

// Update user profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.driver.id);

    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        name: user.name,
        phone: user.phone,
        email: user.email,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user profile'
    });
  }
});

module.exports = router;