import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiEye } from 'react-icons/fi';
import { API_URL } from '../../config';

const ViewUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        const res = await axios.get(`${API_URL}/admin/users`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setUsers(res.data.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch users');
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div className="w-full h-full px-12 py-8">
      <h1 className="text-3xl font-bold text-blue-700 mb-2 text-left flex items-center gap-2"><FiUser className="inline-block" /> All Users</h1>
      {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 border-l-4 border-red-500 text-sm">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-3 px-4 text-left">Name</th>
              <th className="py-3 px-4 text-left">Email</th>
              <th className="py-3 px-4 text-left">Phone</th>
              <th className="py-3 px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="text-center py-8">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="4" className="text-center py-8 text-gray-500">No users found</td></tr>
            ) : users.map(user => (
              <tr key={user._id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-semibold flex items-center gap-2"><FiUser className="text-blue-400" /> {user.name}</td>
                <td className="py-3 px-4">{user.email}</td>
                <td className="py-3 px-4">{user.phone}</td>
                <td className="py-3 px-4 flex gap-2">
                  <button className="p-2 rounded hover:bg-gray-200" title="View Details" onClick={() => navigate(`/admin/users/${user._id}`)}><FiEye /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ViewUsers;
