import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaUserPlus, FaCar, FaUsers, FaUser, FaFileExport, FaChartLine, FaCog } from 'react-icons/fa';
import ModernCard from './ModernCard';
import { useAdmin } from '../../contexts/AdminContext';

const QuickActions = () => {
  const navigate = useNavigate();
  const { hasPermission, PERMISSIONS } = useAdmin();

  const quickActions = [
    {
      title: 'Register New Driver',
      description: 'Add a new driver to the system',
      icon: <FaCar className="text-blue-600" />,
      onClick: () => navigate('/admin/register-driver'),
      color: 'blue',
      permission: PERMISSIONS.DRIVERS_CREATE
    },
    {
      title: 'Add New User',
      description: 'Create a new user account',
      icon: <FaUserPlus className="text-green-600" />,
      onClick: () => navigate('/admin/add-user'),
      color: 'green',
      permission: PERMISSIONS.USERS_CREATE
    },
    {
      title: 'View All Drivers',
      description: 'Manage and verify drivers',
      icon: <FaUsers className="text-purple-600" />,
      onClick: () => navigate('/admin/drivers'),
      color: 'purple',
      permission: PERMISSIONS.DRIVERS_VIEW
    },
    {
      title: 'View All Users',
      description: 'Manage user accounts',
      icon: <FaUser className="text-orange-600" />,
      onClick: () => navigate('/admin/view-users'),
      color: 'orange',
      permission: PERMISSIONS.USERS_VIEW
    },
    {
      title: 'Generate Reports',
      description: 'View analytics and reports',
      icon: <FaChartLine className="text-indigo-600" />,
      onClick: () => navigate('/admin/reports'),
      color: 'indigo',
      permission: PERMISSIONS.FINANCIAL_VIEW
    },
    {
      title: 'Export Data',
      description: 'Export user and driver data',
      icon: <FaFileExport className="text-teal-600" />,
      onClick: () => {
        // Export functionality
        alert('Export functionality coming soon!');
      },
      color: 'teal',
      permission: PERMISSIONS.FINANCIAL_EXPORT
    }
  ].filter(action => !action.permission || hasPermission(action.permission));

  const getColorClasses = (color) => {
    const colorMap = {
      blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      green: 'bg-green-50 border-green-200 hover:bg-green-100',
      purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      orange: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
      indigo: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
      teal: 'bg-teal-50 border-teal-200 hover:bg-teal-100'
    };
    return colorMap[color] || 'bg-gray-50 border-gray-200 hover:bg-gray-100';
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Quick Actions</h2>
        {hasPermission(PERMISSIONS.SETTINGS_VIEW) && (
          <button
            onClick={() => navigate('/admin/settings')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <FaCog className="h-4 w-4" />
            <span className="text-sm">Settings</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quickActions.map((action, index) => (
          <div
            key={index}
            onClick={action.onClick}
            className={`
              p-6 rounded-lg border-2 cursor-pointer transition-all duration-200 
              ${getColorClasses(action.color)}
              hover:shadow-md transform hover:-translate-y-1
            `}
          >
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                  {action.icon}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {action.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;