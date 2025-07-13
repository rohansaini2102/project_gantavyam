import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUsers, FaCar, FaCheckCircle, FaRoute } from 'react-icons/fa';
import StatsCard from './StatsCard';
import { admin as adminAPI } from '../../services/api';
import socketService from '../../services/socket';

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
    setupSocketListeners();
  }, []);

  const setupSocketListeners = async () => {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) return;

    try {
      const socket = await socketService.initialize(adminToken);
      
      if (socket) {
        console.log('📊 [DashboardStats] Setting up socket listeners for real-time stats');
        
        // Listen for new ride requests
        socket.on('newRideRequest', () => {
          setStats(prev => ({
            ...prev,
            totalRides: prev.totalRides + 1
          }));
        });
        
        // Listen for ride completions
        socket.on('rideCompleted', () => {
          // Optionally refresh all stats periodically for accuracy
          setTimeout(fetchStats, 2000);
        });
        
        // Listen for new user registrations
        socket.on('newUserRegistration', () => {
          setStats(prev => ({
            ...prev,
            totalUsers: prev.totalUsers + 1
          }));
        });
        
        // Listen for driver verifications
        socket.on('driverVerified', () => {
          setStats(prev => ({
            ...prev,
            activeDrivers: prev.activeDrivers + 1,
            pendingApprovals: Math.max(0, prev.pendingApprovals - 1)
          }));
        });
      }
    } catch (error) {
      console.error('📊 [DashboardStats] Error setting up socket listeners:', error);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch comprehensive dashboard stats from server
      const dashboardResponse = await adminAPI.getDashboardStats();
      
      if (dashboardResponse.success) {
        // Use real data from the server
        const serverStats = dashboardResponse.data;
        setStats({
          totalUsers: serverStats.totalUsers || 0,
          totalDrivers: serverStats.totalDrivers || 0,
          activeDrivers: serverStats.activeDrivers || 0,
          totalRides: serverStats.totalRides || 0,
          pendingApprovals: serverStats.pendingApprovals || 0,
          todayRides: serverStats.todayRides || 0
        });
      } else {
        // Fallback to individual API calls if dashboard stats endpoint fails
        console.log('📊 [DashboardStats] Dashboard stats endpoint failed, using fallback method');
        
        // Fetch users and drivers separately
        const [usersResponse, driversResponse] = await Promise.all([
          adminAPI.getAllUsers(),
          adminAPI.getAllDrivers()
        ]);
        
        const users = usersResponse.data || [];
        const drivers = driversResponse.data || [];
        
        // Calculate basic stats
        const activeDrivers = drivers.filter(driver => driver.isVerified).length;
        const pendingApprovals = drivers.filter(driver => !driver.isVerified).length;
        
        // Try to get ride stats from ride analytics
        let totalRides = 0;
        let todayRides = 0;
        
        try {
          const ridesResponse = await adminAPI.getRideAnalytics();
          if (ridesResponse.success) {
            totalRides = ridesResponse.data.totalRides || 0;
            todayRides = ridesResponse.data.todayRides || 0;
          }
        } catch (rideError) {
          console.warn('📊 [DashboardStats] Could not fetch ride analytics:', rideError);
          // Use fallback values or try basic rides API
          try {
            const basicRidesResponse = await adminAPI.getRides({ limit: 1 });
            if (basicRidesResponse.success && basicRidesResponse.data.pagination) {
              totalRides = basicRidesResponse.data.pagination.total || 0;
            }
          } catch (basicRideError) {
            console.warn('📊 [DashboardStats] Could not fetch basic ride count:', basicRideError);
          }
        }
        
        setStats({
          totalUsers: users.length,
          totalDrivers: drivers.length,
          activeDrivers,
          pendingApprovals,
          totalRides,
          todayRides
        });
      }
    } catch (error) {
      console.error('📊 [DashboardStats] Error fetching stats:', error);
      
      // Set error state with zero values to avoid showing stale data
      setStats({
        totalUsers: 0,
        totalDrivers: 0,
        activeDrivers: 0,
        totalRides: 0,
        pendingApprovals: 0,
        todayRides: 0
      });
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