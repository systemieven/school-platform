import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AdminHeader from './components/AdminHeader';

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <AdminHeader sidebarCollapsed={collapsed} />

      <main
        className={`transition-all duration-300 p-6 ${
          collapsed ? 'ml-[72px]' : 'ml-64'
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
