import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaUserPlus, FaUsers, FaCar, FaUser, FaHome } from 'react-icons/fa';

const navLinks = [
  { to: '/admin', label: 'Home', icon: <FaHome /> },
  { to: '/admin/register-driver', label: 'Driver Registration', icon: <FaCar /> },
  { to: '/admin/add-user', label: 'User Registration', icon: <FaUserPlus /> },
  { to: '/admin/drivers', label: 'All Drivers', icon: <FaUsers /> },
  { to: '/admin/view-users', label: 'All Users', icon: <FaUser /> },
];

const AdminSidebar = () => {
  const location = useLocation();
  return (
    <aside className="w-64 bg-white shadow-lg flex flex-col py-8 px-4 min-h-screen">
      <div className="flex items-center gap-2 mb-8 justify-center">
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white text-xl">G</div>
        <span className="text-blue-700 text-2xl font-bold tracking-wide ml-2">GANTAVYAM</span>
      </div>
      <nav className="flex-1">
        <ul className="space-y-2">
          {navLinks.map(link => (
            <li key={link.to}>
              <Link
                to={link.to}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${location.pathname === link.to ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-100'}`}
              >
                <span className="text-lg">{link.icon}</span>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-8 text-xs text-gray-400 text-center">&copy; 2025 GANTAVYAM</div>
    </aside>
  );
};

export default AdminSidebar; 