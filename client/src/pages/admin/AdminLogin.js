import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post(`${API_URL}/admin/login`, { email, password });
      if (res.data.success && res.data.token) {
        localStorage.setItem('adminToken', res.data.token);
        localStorage.setItem('admin', JSON.stringify(res.data.admin));
        navigate('/admin');
      } else {
        setError('Login failed.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 py-8">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 mb-4">
        <h2 className="text-2xl font-bold text-blue-700 mb-6 text-center">Admin Login</h2>
        {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 border-l-4 border-red-500">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-gray-700 font-medium mb-1">Email</label>
            <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-700 font-medium mb-1">Password</label>
            <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-800 transition">Login</button>
        </form>
      </div>
      <div className="text-center text-gray-500 text-xs mt-2">&copy; 2025 GANTAVYAM. All rights reserved.</div>
    </div>
  );
};

export default AdminLogin; 