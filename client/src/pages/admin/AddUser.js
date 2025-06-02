import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';

const AddUser = () => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/users/register`, formData);
      setMessage('User registration successful!');
    } catch (err) {
      setMessage('Failed to register user');
    }
  };

  return (
    <div className="w-full h-full px-12 py-8">
      <h2 className="text-2xl font-bold text-blue-700 mb-6 text-left">Add a New User (Customer)</h2>
      {message && (
        <div className={`px-4 py-2 rounded mb-4 border-l-4 text-sm ${message.includes('successful') ? 'bg-green-100 text-green-700 border-green-500' : 'bg-red-100 text-red-700 border-red-500'}`}>{message}</div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl">
        <div>
          <label htmlFor="name" className="block text-gray-700 font-medium mb-1">Name</label>
          <input type="text" name="name" id="name" placeholder="Name" onChange={handleChange} required className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label htmlFor="email" className="block text-gray-700 font-medium mb-1">Email</label>
          <input type="email" name="email" id="email" placeholder="Email" onChange={handleChange} required className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label htmlFor="phone" className="block text-gray-700 font-medium mb-1">Phone Number</label>
          <input type="text" name="phone" id="phone" placeholder="Phone Number" onChange={handleChange} required className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label htmlFor="password" className="block text-gray-700 font-medium mb-1">Password</label>
          <input type="password" name="password" id="password" placeholder="Password" onChange={handleChange} required className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="col-span-1 md:col-span-2 flex items-center justify-start mt-4">
          <button type="submit" className="bg-blue-600 text-white font-semibold py-2 px-8 rounded hover:bg-blue-800 transition">Register</button>
        </div>
      </form>
    </div>
  );
};

export default AddUser;
