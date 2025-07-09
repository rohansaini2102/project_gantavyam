import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config';
import ModernCard from '../../components/admin/ModernCard';
import { FiUser, FiMail, FiPhone, FiArrowLeft, FiCalendar } from 'react-icons/fi';

const ViewUserDetails = () => {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        const res = await axios.get(`${API_URL}/admin/users/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setUser(res.data.data);
      } catch (error) {
        console.error('Error fetching user details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-gray-500">User not found</p>
          <button
            onClick={() => navigate('/admin/view-users')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Details</h1>
          <p className="text-gray-600 mt-1">View user information</p>
        </div>
        <button
          onClick={() => navigate('/admin/view-users')}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <FiArrowLeft className="h-4 w-4" />
          <span>Back to Users</span>
        </button>
      </div>

      {/* User Information Card */}
      <ModernCard
        title="User Information"
        icon={<FiUser className="text-blue-600" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{user.name}</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <FiMail className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-sm font-medium text-gray-900">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <FiPhone className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="text-sm font-medium text-gray-900">{user.phone}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <FiCalendar className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Registered</p>
                  <p className="text-sm font-medium text-gray-900">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Summary</h3>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Rides</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Last Active</p>
                <p className="text-sm font-medium text-gray-900">
                  {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </ModernCard>

      {/* Ride History */}
      <ModernCard
        title="Ride History"
        subtitle="User's ride activity"
      >
        <div className="text-center py-8">
          <p className="text-gray-500">No ride history available</p>
          <p className="text-sm text-gray-400 mt-2">Ride tracking will be implemented soon</p>
        </div>
      </ModernCard>
    </div>
  );
};

export default ViewUserDetails;
