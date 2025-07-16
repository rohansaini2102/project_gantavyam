import { SOCKET_URL } from '../config';

// Utility function to get the correct image URL
export const getImageUrl = (imagePath) => {
  // If it's already a full URL (Cloudinary or other external URL), return as is
  if (imagePath && (imagePath.startsWith('http://') || imagePath.startsWith('https://'))) {
    return imagePath;
  }
  
  // If it's a relative path, prepend the backend URL
  if (imagePath) {
    return `${SOCKET_URL}/${imagePath}`;
  }
  
  // Return null if no image path
  return null;
};

// Check if image is from Cloudinary
export const isCloudinaryImage = (imagePath) => {
  return imagePath && imagePath.includes('cloudinary.com');
};

// Get optimized Cloudinary URL with transformations
export const getOptimizedCloudinaryUrl = (url, transformations = {}) => {
  if (!isCloudinaryImage(url)) return url;
  
  const defaultTransformations = {
    width: 800,
    height: 600,
    crop: 'limit',
    quality: 'auto',
    fetch_format: 'auto'
  };
  
  const transforms = { ...defaultTransformations, ...transformations };
  const transformString = Object.entries(transforms)
    .map(([key, value]) => `${key[0]}_${value}`)
    .join(',');
  
  // Insert transformations into Cloudinary URL
  const parts = url.split('/upload/');
  if (parts.length === 2) {
    return `${parts[0]}/upload/${transformString}/${parts[1]}`;
  }
  
  return url;
};