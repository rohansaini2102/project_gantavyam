import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../../services/api';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      console.log('🔐 [Admin Login] Attempting login with:', { email });
      
      // Test connectivity first
      try {
        const testResponse = await fetch('http://localhost:5000/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test', password: 'test' })
        });
        console.log('🔐 [Admin Login] Connectivity test:', testResponse.status);
      } catch (connectError) {
        console.error('🔐 [Admin Login] Connectivity test failed:', connectError);
        setError('Cannot connect to server. Please check if the backend is running.');
        return;
      }
      
      const response = await adminLogin({ email, password });
      console.log('🔐 [Admin Login] Login response:', response);
      
      if (response.success && response.token) {
        console.log('🔐 [Admin Login] Login successful, navigating to admin');
        console.log('🔐 [Admin Login] Token stored:', !!localStorage.getItem('adminToken'));
        navigate('/admin');
      } else {
        console.error('🔐 [Admin Login] Login failed - no token in response:', response);
        setError('Login failed.');
      }
    } catch (err) {
      console.error('🔐 [Admin Login] Login error:', err);
      setError(err.error || err.message || 'Login failed.');
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