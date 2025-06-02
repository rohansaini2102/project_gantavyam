import React from 'react';
import { Link } from 'react-router-dom';

const colorMap = {
  blue: 'bg-blue-600 hover:bg-blue-800',
  green: 'bg-green-600 hover:bg-green-800',
  orange: 'bg-orange-500 hover:bg-orange-700',
  purple: 'bg-purple-600 hover:bg-purple-800',
};

const AdminDashboardCard = ({ label, to, color = 'blue' }) => (
  <Link to={to} className="w-full">
    <button className={`w-full ${colorMap[color]} text-white font-semibold py-3 rounded transition mb-2`}>
      {label}
    </button>
  </Link>
);

export default AdminDashboardCard; 