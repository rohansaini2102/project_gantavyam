import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { SidebarProvider, useSidebar } from '../../contexts/SidebarContext';

const AdminLayoutContent = () => {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen flex bg-gray-50">
      <AdminSidebar />
      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
        isCollapsed ? 'ml-16' : 'ml-64'
      }`}>
        <AdminHeader />
        <main className="flex-1 p-6 mt-16 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const AdminLayout = () => (
  <SidebarProvider>
    <AdminLayoutContent />
  </SidebarProvider>
);

export default AdminLayout; 