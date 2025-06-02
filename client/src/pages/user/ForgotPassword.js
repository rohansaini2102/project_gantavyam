import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';

const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // Check if the phone number exists in the system
      const response = await axios.post(`${API_URL}/users/check-phone`, { phone });
      
      if (response.data.success) {
        setSuccess('Phone number verified successfully.');
        setStep(2); // Move to password reset step
      } else {
        setError(response.data.message || 'Phone number not found.');
      }
    } catch (err) {
      setIsLoading(false);
      // Improved error handling
      if (err.response && err.response.status === 404) {
        setError('Phone number not found.');
      } else if (err.response && err.response.status === 400) {
        setError('Bad request. Please check your input.');
      } else if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else if (err.message === 'Network Error') {
        setError('Network error: Please check your connection or server.');
      } else {
        setError('Failed to verify phone number. Please try again.');
      }
      // Log the error for debugging
      console.error('Error checking phone:', err);
      return;
    }
    setIsLoading(false);
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`${API_URL}/users/reset-password`, {
        phone,
        newPassword
      });
      
      if (response.data.success) {
        setSuccess('Password reset successful! Please login with your new password.');
        setTimeout(() => {
          navigate('/user/login');
        }, 3000);
      } else {
        setError(response.data.message || 'Failed to reset password.');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 py-8">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 mb-4">
        <h2 className="text-2xl font-bold text-blue-700 mb-6 text-center">Forgot Password</h2>
        {error && <div className="px-4 py-2 rounded mb-4 border-l-4 text-sm bg-red-100 text-red-700 border-red-500">{error}</div>}
        {success && <div className="px-4 py-2 rounded mb-4 border-l-4 text-sm bg-green-100 text-green-700 border-green-500">{success}</div>}
        
        {step === 1 ? (
          // Step 1: Enter phone number
          <form onSubmit={handlePhoneSubmit} className="space-y-6">
            <div>
              <label htmlFor="phone" className="block text-gray-700 font-medium mb-1">Phone Number</label>
              <input 
                type="text" 
                id="phone"
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="Enter your registered phone number" 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-800 transition disabled:bg-gray-400 flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="loader border-2 border-t-2 border-t-white border-blue-200 rounded-full w-5 h-5 animate-spin mr-2"></span>
              ) : (
                'Verify Phone'
              )}
            </button>
            
            <div className="mt-6 text-center">
              <Link to="/user/login" className="text-blue-600 font-semibold hover:underline">Back to Login</Link>
            </div>
          </form>
        ) : (
          // Step 2: Enter new password
          <form onSubmit={handlePasswordReset} className="space-y-6">
            <div>
              <label htmlFor="newPassword" className="block text-gray-700 font-medium mb-1">New Password</label>
              <input 
                type="password" 
                id="newPassword"
                name="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder="Enter new password" 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-gray-700 font-medium mb-1">Confirm Password</label>
              <input 
                type="password" 
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="Confirm new password" 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-800 transition disabled:bg-gray-400 flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="loader border-2 border-t-2 border-t-white border-blue-200 rounded-full w-5 h-5 animate-spin mr-2"></span>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}
      </div>
      <div className="text-center text-gray-500 text-xs mt-2">&copy; 2025 GANTAVYAM. All rights reserved.</div>
    </div>
  );
};

export default ForgotPassword;