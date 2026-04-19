import { useState, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AdminHeader from './components/AdminHeader';
import AiContextualNudge from './components/AiContextualNudge';
import { WhatsAppStatusProvider } from './contexts/WhatsAppStatusContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { useBranding } from '../contexts/BrandingContext';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'admin_sidebar_collapsed';

export default function AdminLayout() {
  const { identity } = useBranding();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  // Set document title for admin area
  useEffect(() => {
    const schoolName = identity.school_name || '';
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

  // Sincroniza `system_settings.general.site_url` com `window.location.origin`
  // no primeiro carregamento do admin. Assim o edge function `auto-notify`
  // (que roda via DB trigger e não tem origin HTTP) sempre recebe a URL
  // pública correta pra renderizar {{schedule_url}} e {{careers_url}}.
  // Segue o mesmo padrão de `system_url` usado nos fluxos de senha temporária,
  // mas persistido no DB em vez de enviado no body (trigger não tem acesso).
  useEffect(() => {
    const origin = window.location.origin.replace(/\/+$/, '');
    if (!origin) return;
    // Só sincroniza origens públicas. Dev (localhost, 127.x, *.local, IPs de
    // rede privada) nunca sobrescreve o valor de produção — senão abrir
    // localhost sobrescreveria o site_url e quebraria {{schedule_url}} dos
    // templates que disparam em produção.
    const host = window.location.hostname;
    const isDev =
      host === 'localhost' ||
      host.endsWith('.local') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (isDev) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('id, value')
          .eq('category', 'general')
          .eq('key', 'site_url')
          .maybeSingle();
        const current = typeof data?.value === 'string' ? data.value : '';
        if (current === origin) return;
        // Se já existe um valor válido (URL pública com host), respeita o que
        // o admin configurou em /admin/configuracoes → Institucional. Só
        // auto-popula quando o campo está vazio ou corrompido.
        if (current) {
          try {
            const u = new URL(current);
            if (u.host && u.protocol.startsWith('http')) return;
          } catch { /* valor corrompido — cai no overwrite abaixo */ }
        }
        if (data?.id) {
          await supabase.from('system_settings').update({ value: origin }).eq('id', data.id);
        } else {
          await supabase.from('system_settings').insert({
            category: 'general',
            key: 'site_url',
            value: origin,
            description: 'URL pública do site (auto-sincronizado pelo admin a cada carregamento).',
          });
        }
      } catch {
        // Silencioso: não-admin ou RLS bloqueou — edge function usa fallback.
      }
    })();
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
          <AiContextualNudge />
        </div>
      </WhatsAppStatusProvider>
    </PermissionsProvider>
  );
}
