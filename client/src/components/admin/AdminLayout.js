import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

const AdminLayout = () => (
  <div className="min-h-screen flex bg-gray-50">
    <AdminSidebar />
    <div className="flex-1 flex flex-col ml-64">
      <AdminHeader />
      <main className="flex-1 p-6 mt-16 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  </div>
);

export default AdminLayout; 