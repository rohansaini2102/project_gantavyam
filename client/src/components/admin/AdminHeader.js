import React, { useState } from 'react';
import { FaSearch, FaBell, FaUserCircle, FaChevronDown, FaSignOutAlt, FaCog } from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';

const AdminHeader = () => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin');
    navigate('/admin/login');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/admin' || path === '/admin/') return 'Dashboard';
    if (path === '/admin/add-user') return 'Add New User';
    if (path === '/admin/register-driver') return 'Register Driver';
    if (path === '/admin/drivers') return 'All Drivers';
    if (path === '/admin/view-users') return 'All Users';
    if (path.includes('/admin/users/')) return 'User Details';
    return 'Admin Panel';
  };

  const getBreadcrumbs = () => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length <= 1) return null;
    
    const breadcrumbs = segments.map((segment, index) => {
      const isLast = index === segments.length - 1;
      const href = '/' + segments.slice(0, index + 1).join('/');
      
      let title = segment;
      if (segment === 'admin') title = 'Admin';
      if (segment === 'add-user') title = 'Add User';
      if (segment === 'register-driver') title = 'Register Driver';
      if (segment === 'drivers') title = 'Drivers';
      if (segment === 'view-users') title = 'Users';
      
      return { title, href, isLast };
    });

    return breadcrumbs;
  };

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-6 z-30">
      {/* Left side - Title and Breadcrumbs */}
      <div className="flex flex-col">
        <h1 className="text-xl font-semibold text-gray-800">{getPageTitle()}</h1>
        {getBreadcrumbs() && (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            {getBreadcrumbs().map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span>/</span>}
                {crumb.isLast ? (
                  <span className="text-blue-600">{crumb.title}</span>
                ) : (
                  <button
                    onClick={() => navigate(crumb.href)}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {crumb.title}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Right side - Search, Notifications, Profile */}
      <div className="flex items-center space-x-4">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search users, drivers..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <FaBell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
              3
            </span>
          </button>
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center space-x-3 text-gray-700 hover:text-gray-900 focus:outline-none"
          >
            <div className="flex items-center space-x-2">
              <FaUserCircle className="h-8 w-8 text-blue-600" />
              <div className="text-left">
                <p className="text-sm font-medium">Admin</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
            </div>
            <FaChevronDown className={`h-4 w-4 transition-transform ${showUserDropdown ? 'transform rotate-180' : ''}`} />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  // Add settings navigation here
                }}
                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <FaCog className="h-4 w-4" />
                <span>Settings</span>
              </button>
              <hr className="my-1" />
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <FaSignOutAlt className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;