// client/src/pages/BoothAdmin.js
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="text-2xl md:text-3xl font-bold text-blue-700 mb-6">Welcome to the Admin Dashboard</div>
      <div className="w-full max-w-2xl h-40 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xl border-dashed border-2 border-gray-300">
        Ride Booking (Coming Soon)
      </div>
    </div>
  );
};

export default Dashboard;