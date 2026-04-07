import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AdminHeader from './components/AdminHeader';

const STORAGE_KEY = 'admin_sidebar_collapsed';

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <AdminHeader sidebarCollapsed={collapsed} onToggleSidebar={toggle} />

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
