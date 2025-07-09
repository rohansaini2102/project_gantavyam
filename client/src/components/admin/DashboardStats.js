import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUsers, FaCar, FaCheckCircle, FaRoute } from 'react-icons/fa';
import StatsCard from './StatsCard';
import { admin as adminAPI } from '../../services/api';

const DashboardStats = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    totalRides: 0,
    pendingApprovals: 0,
    todayRides: 0
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch users
      const usersResponse = await adminAPI.getAllUsers();
      const users = usersResponse.data || [];
      
      // Fetch drivers
      const driversResponse = await adminAPI.getAllDrivers();
      const drivers = driversResponse.data || [];
      
      // Calculate stats
      const activeDrivers = drivers.filter(driver => driver.isVerified).length;
      const pendingApprovals = drivers.filter(driver => !driver.isVerified).length;
      
      setStats({
        totalUsers: users.length,
        totalDrivers: drivers.length,
        activeDrivers,
        pendingApprovals,
        totalRides: 247, // Mock data - would come from rides API
        todayRides: 12   // Mock data - would come from today's rides
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      change: '+12%',
      changeType: 'positive',
      icon: <FaUsers />,
      iconBg: 'bg-blue-500',
      subtitle: 'Registered customers',
      onClick: () => navigate('/admin/view-users')
    },
    {
      title: 'Active Drivers',
      value: stats.activeDrivers,
      change: '+8%',
      changeType: 'positive',
      icon: <FaCar />,
      iconBg: 'bg-green-500',
      subtitle: 'Verified and active',
      onClick: () => navigate('/admin/drivers')
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingApprovals,
      change: stats.pendingApprovals > 0 ? `${stats.pendingApprovals} pending` : 'All clear',
      changeType: stats.pendingApprovals > 0 ? 'negative' : 'positive',
      icon: <FaCheckCircle />,
      iconBg: stats.pendingApprovals > 0 ? 'bg-orange-500' : 'bg-green-500',
      subtitle: 'Driver verifications',
      onClick: () => navigate('/admin/drivers')
    },
    {
      title: 'Total Rides',
      value: stats.totalRides,
      change: '+23%',
      changeType: 'positive',
      icon: <FaRoute />,
      iconBg: 'bg-purple-500',
      subtitle: 'Completed rides',
      onClick: () => navigate('/admin/reports')
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statsCards.map((card, index) => (
        <StatsCard
          key={index}
          title={card.title}
          value={card.value}
          change={card.change}
          changeType={card.changeType}
          icon={card.icon}
          iconBg={card.iconBg}
          subtitle={card.subtitle}
          onClick={card.onClick}
          loading={loading}
        />
      ))}
    </div>
  );
};

export default DashboardStats;