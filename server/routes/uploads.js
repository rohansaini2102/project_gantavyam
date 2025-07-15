const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { uploadsDir } = require('../config/localStorage');

// Serve uploaded files
router.get('/*', (req, res) => {
  try {
    const filePath = path.join(uploadsDir, req.params[0]);
    
    // Security check: ensure file is within uploads directory
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadsDir = path.resolve(uploadsDir);
    
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Check if it's a file (not directory)
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Set appropriate headers
    const fileExtension = path.extname(resolvedPath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (fileExtension) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Stream the file
    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
    
    stream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error reading file'
        });
      }
    });
    
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Get file info endpoint
router.head('/*', (req, res) => {
  try {
    const filePath = path.join(uploadsDir, req.params[0]);
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadsDir = path.resolve(uploadsDir);
    
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      return res.status(403).end();
    }
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).end();
    }
    
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return res.status(404).end();
    }
    
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Last-Modified', stats.mtime.toUTCString());
    res.status(200).end();
    
  } catch (error) {
    console.error('Error getting file info:', error);
    res.status(500).end();
  }
});

module.exports = router;