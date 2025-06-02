import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config';

const ViewUserDetails = () => {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  useEffect(() => {
    const fetchDetails = async () => {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/admin/users/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setUser(res.data.data);
    };
    fetchDetails();
  }, [id]);

  if (!user) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 py-8">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 mb-4">
        <h2 className="text-2xl font-bold text-blue-700 mb-6 text-center">User Details</h2>
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-2">{user.name}</h3>
          <p><span className="font-semibold">Email:</span> {user.email}</p>
          <p><span className="font-semibold">Phone:</span> {user.phone}</p>
          <p><span className="font-semibold">Ride History:</span> (to be implemented)</p>
        </div>
        <Link to="/admin/view-users" className="text-blue-600 hover:underline mb-4 inline-block">Back to List</Link>
      </div>
      <div className="text-center text-gray-500 text-xs mt-2">&copy; 2025 GANTAVYAM. All rights reserved.</div>
    </div>
  );
};

export default ViewUserDetails;
