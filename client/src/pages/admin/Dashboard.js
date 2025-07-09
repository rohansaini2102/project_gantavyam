import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaClock, FaUsers, FaBell } from 'react-icons/fa';
import DashboardStats from '../../components/admin/DashboardStats';
import QuickActions from '../../components/admin/QuickActions';
import ModernCard from '../../components/admin/ModernCard';

const Dashboard = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Mock recent activity data
    setRecentActivity([
      { id: 1, type: 'driver', message: 'New driver registration: John Doe', time: '2 minutes ago' },
      { id: 2, type: 'user', message: 'User Sarah Smith registered', time: '5 minutes ago' },
      { id: 3, type: 'approval', message: 'Driver Mike Johnson approved', time: '12 minutes ago' },
      { id: 4, type: 'ride', message: 'Ride completed: DL-1234 to Airport', time: '25 minutes ago' },
      { id: 5, type: 'system', message: 'System backup completed', time: '1 hour ago' }
    ]);

    return () => clearInterval(timer);
  }, []);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'driver':
        return <FaUsers className="text-blue-600" />;
      case 'user':
        return <FaUsers className="text-green-600" />;
      case 'approval':
        return <FaBell className="text-orange-600" />;
      case 'ride':
        return <FaCalendarAlt className="text-purple-600" />;
      default:
        return <FaClock className="text-gray-600" />;
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Welcome back, Admin!</h1>
            <p className="text-blue-100">Here's what's happening with your Gantavyam platform today.</p>
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm">{formatDate(currentTime)}</p>
            <p className="text-xl font-mono font-bold">{formatTime(currentTime)}</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <DashboardStats />

      {/* Quick Actions */}
      <QuickActions />

      {/* Recent Activity and System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <ModernCard
          title="Recent Activity"
          subtitle="Latest system events"
          icon={<FaBell className="text-orange-600" />}
        >
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </ModernCard>

        {/* System Health */}
        <ModernCard
          title="System Health"
          subtitle="Platform status overview"
          icon={<FaClock className="text-green-600" />}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Server Status</span>
              </div>
              <span className="text-sm text-green-700 font-semibold">Operational</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Database</span>
              </div>
              <span className="text-sm text-green-700 font-semibold">Connected</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-sm font-medium">SMS Service</span>
              </div>
              <span className="text-sm text-yellow-700 font-semibold">Pending Setup</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-sm font-medium">Payment Gateway</span>
              </div>
              <span className="text-sm text-yellow-700 font-semibold">Pending Setup</span>
            </div>
          </div>
        </ModernCard>
      </div>

      {/* Quick Stats Footer */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Platform Version: v1.0.0</span>
          <span>Last Updated: {formatDate(new Date())}</span>
          <span>Uptime: 99.9%</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;