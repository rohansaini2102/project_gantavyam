import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminMain from './AdminMain';
import { FaUserCircle } from 'react-icons/fa';

const AdminHeader = () => (
  <header className="w-full h-16 bg-white shadow flex items-center justify-between px-8 fixed top-0 left-0 z-20" style={{marginLeft: '16rem'}}>
    <div className="text-xl font-bold text-blue-700">Admin Panel</div>
    <div className="text-2xl text-blue-700"><FaUserCircle /></div>
  </header>
);

const AdminFooter = () => (
  <footer className="w-full py-3 bg-gray-100 text-center text-xs text-gray-400 border-t mt-8">Admin Panel &copy; 2025 GANTAVYAM</footer>
);

const AdminLayout = () => (
  <div className="min-h-screen flex bg-gray-100">
    <AdminSidebar />
    <div className="flex-1 flex flex-col min-h-screen" style={{marginLeft: '16rem'}}>
      <AdminHeader />
      <div className="flex-1 pt-20 pb-4 flex flex-col items-center justify-center">
        <AdminMain>
          <Outlet />
        </AdminMain>
      </div>
      <AdminFooter />
    </div>
  </div>
);

export default AdminLayout; 