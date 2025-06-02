import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../../services/api';

const UserLogin = () => {
  const [formData, setFormData] = useState({ phone: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await auth.userLogin(formData);
      
      if (response.success) {
        // Save token
        localStorage.setItem('userToken', response.token);
        
        // Save user data - corrected line
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Redirect to dashboard
        navigate('/user/dashboard');
      } else {
        setError(response.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      setIsLoading(false);
      // Improved error handling
      if (err.response && err.response.status === 401) {
        setError('Invalid phone number or password. Please try again.');
      } else if (err.response && err.response.status === 400) {
        setError('Bad request. Please check your input.');
      } else if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else if (err.message === 'Network Error') {
        setError('Network error: Please check your connection or server.');
      } else {
        setError('Login failed. Please try again.');
      }
      // Log the error for debugging
      console.error('Login error:', err);
      return;
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 py-8">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 mb-4">
        <h2 className="text-2xl font-bold text-blue-700 mb-6 text-center">User Login</h2>
        {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 border-l-4 border-red-500 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="phone" className="block text-gray-700 font-medium mb-1">Phone Number</label>
            <input
              type="text"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter your phone number"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-700 font-medium mb-1">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-sm mb-2">
            <Link to="/user/forgot-password" className="text-blue-600 hover:underline">Forgot Password?</Link>
            <Link to="/user/signup" className="text-blue-600 hover:underline">New here? Create account</Link>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-800 transition disabled:bg-gray-400 flex items-center justify-center"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loader border-2 border-t-2 border-t-white border-blue-200 rounded-full w-5 h-5 animate-spin mr-2"></span>
            ) : (
              'Login'
            )}
          </button>
        </form>
      </div>
      <div className="text-center text-gray-500 text-xs mt-2">&copy; 2025 GANTAVYAM. All rights reserved.</div>
    </div>
  );
};

export default UserLogin;