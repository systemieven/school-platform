import { useState, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AdminHeader from './components/AdminHeader';
import { WhatsAppStatusProvider } from './contexts/WhatsAppStatusContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { useBranding } from '../contexts/BrandingContext';

const STORAGE_KEY = 'admin_sidebar_collapsed';

export default function AdminLayout() {
  const { identity } = useBranding();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  // Set document title for admin area
  useEffect(() => {
    const schoolName = identity.school_name || 'Colégio Batista';
    document.title = `Gestão | ${schoolName}`;
    return () => { document.title = schoolName; };
  }, [identity.school_name]);

  // Restore dark mode preference on mount — light is default
  useEffect(() => {
    try {
      const theme = localStorage.getItem('admin_theme');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      document.documentElement.classList.remove('dark');
    }
    // Cleanup: remove dark class when leaving admin
    return () => { document.documentElement.classList.remove('dark'); };
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <PermissionsProvider>
      <WhatsAppStatusProvider>
        <div className="admin-layout min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
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
      </WhatsAppStatusProvider>
    </PermissionsProvider>
  );
}
