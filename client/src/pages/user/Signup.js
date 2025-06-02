import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../../services/api';

const UserSignup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await auth.userRegister(formData);
      setMessage('Signup successful! Please login.');
      navigate('/user/login');
    } catch (err) {
      setMessage('Signup failed. Try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 py-8">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 mb-4">
        <h2 className="text-2xl font-bold text-blue-700 mb-6 text-center">User Signup</h2>
        {message && (
          <div className={`px-4 py-2 rounded mb-4 border-l-4 text-sm ${message.includes('successful') ? 'bg-green-100 text-green-700 border-green-500' : 'bg-red-100 text-red-700 border-red-500'}`}>{message}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-gray-700 font-medium mb-1">Name</label>
            <input
              type="text"
              name="name"
              id="name"
              placeholder="Name"
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-gray-700 font-medium mb-1">Email</label>
            <input
              type="email"
              name="email"
              id="email"
              placeholder="Email"
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-gray-700 font-medium mb-1">Phone</label>
            <input
              type="text"
              name="phone"
              id="phone"
              placeholder="Phone"
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-700 font-medium mb-1">Password</label>
            <input
              type="password"
              name="password"
              id="password"
              placeholder="Password (min 6)"
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-800 transition"
          >
            Sign Up
          </button>
        </form>
        <div className="mt-6 text-center">
          <Link to="/user/login" className="text-blue-600 font-semibold hover:underline">Already have an account? Login</Link>
        </div>
      </div>
      <div className="text-center text-gray-500 text-xs mt-2">&copy; 2025 GANTAVYAM. All rights reserved.</div>
    </div>
  );
};

export default UserSignup;
