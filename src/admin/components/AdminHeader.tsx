import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useNotifications } from '../hooks/useNotifications';
import { useWhatsAppStatus } from '../contexts/WhatsAppStatusContext';
import { ROLE_LABELS } from '../types/admin.types';
import { Bell, ChevronDown, KeyRound, LogOut, PanelLeftClose, PanelLeftOpen, MessageCircle, UserCog } from 'lucide-react';
import NotificationsPanel from './NotificationsPanel';
import EditProfileDrawer from './EditProfileDrawer';
import ChangePasswordDrawer from './ChangePasswordDrawer';

interface Props {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function AdminHeader({ sidebarCollapsed, onToggleSidebar }: Props) {
  const { profile, signOut } = useAdminAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { state: waState } = useWhatsAppStatus();
  const navigate = useNavigate();
  const [panelOpen,        setPanelOpen]        = useState(false);
  const [menuOpen,         setMenuOpen]         = useState(false);
  const [editProfileOpen,  setEditProfileOpen]  = useState(false);
  const [changePassOpen,   setChangePassOpen]   = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  return (
    <header
      className={`sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 h-16 flex items-center justify-between px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'ml-[72px]' : 'ml-64'
      }`}
    >
      {/* Left: sidebar toggle + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="w-5 h-5" />
          ) : (
            <PanelLeftClose className="w-5 h-5" />
          )}
        </button>
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />
        <Breadcrumb />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* WhatsApp status badge */}
        {waState !== 'unknown' && (
          <button
            onClick={() => navigate('/admin/configuracoes')}
            title={
              waState === 'connected'    ? 'WhatsApp conectado'
              : waState === 'connecting' ? 'WhatsApp conectando…'
              : 'WhatsApp desconectado — clique para configurar'
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <MessageCircle className={`w-4 h-4 ${
              waState === 'connected'    ? 'text-emerald-500'
              : waState === 'connecting' ? 'text-amber-400 animate-pulse'
              : 'text-red-400'
            }`} />
            <span className={`hidden sm:inline ${
              waState === 'connected'    ? 'text-emerald-600 dark:text-emerald-400'
              : waState === 'connecting' ? 'text-amber-500 dark:text-amber-400'
              : 'text-red-500 dark:text-red-400'
            }`}>
              {waState === 'connected' ? 'Conectado' : waState === 'connecting' ? 'Conectando…' : 'Desconectado'}
            </span>
          </button>
        )}

        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Notificações"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {panelOpen && (
            <NotificationsPanel
              notifications={notifications}
              onClose={() => setPanelOpen(false)}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
            />
          )}
        </div>

        {/* Avatar + dropdown */}
        {profile && (
          <div ref={menuRef} className="relative ml-2 pl-4 border-l border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Opções de perfil"
            >
              {/* Avatar with accent ring */}
              <div className="flex-shrink-0">
                <div className="w-[52px] h-[52px] rounded-full p-[3px] bg-brand-secondary">
                  <div className="w-full h-full rounded-full overflow-hidden bg-brand-primary/10 dark:bg-white/10 flex items-center justify-center">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-brand-primary dark:text-brand-secondary">
                        {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight">
                  {profile.full_name || 'Usuário'}
                </p>
                <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  {ROLE_LABELS[profile.role]}
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
                </p>
              </div>
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-50">
                <button
                  onClick={() => { setMenuOpen(false); setEditProfileOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <UserCog className="w-4 h-4 text-gray-400" />
                  Editar perfil
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setChangePassOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-gray-400" />
                  Alterar senha
                </button>
                <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-700" />
                <button
                  onClick={async () => { setMenuOpen(false); await signOut(); navigate('/admin/login'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile drawers — rendered outside the right-section div to avoid stacking context issues */}
      <EditProfileDrawer
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />
      <ChangePasswordDrawer
        open={changePassOpen}
        onClose={() => setChangePassOpen(false)}
      />
    </header>
  );
}

// ── Breadcrumb (uses useLocation for reactivity) ─────────────────────────────
function Breadcrumb() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const segments = location.pathname
    .replace(/^\/admin/, '')
    .split('/')
    .filter(Boolean);

  // Nomes canônicos para cada segmento de rota
  const PATH_LABELS: Record<string, string> = {
    // Gestão
    gestao:                   'Gestão',
    'historico-atendimentos': 'Histórico de Atendimentos',
    // Financeiro
    financeiro:               'Financeiro',
    // Acadêmico
    academico:                'Acadêmico',
    // Escola
    alunos:                   'Alunos',
    importar:                 'Importar',
    responsaveis:             'Responsáveis',
    ocorrencias:              'Ocorrências',
    autorizacoes:             'Autorizações',
    'autorizacoes-saida':     'Autorizações de Saída',
    faltas:                   'Comunicação de Faltas',
    portaria:                 'Portaria',
    'achados-perdidos':       'Achados e Perdidos',
    // Professor
    'area-professor':         'Área do Professor',
    diario:                   'Diário',
    provas:                   'Provas',
    // Biblioteca & Comunicação
    biblioteca:               'Biblioteca Virtual',
    comunicados:              'Comunicados',
    eventos:                  'Eventos',
    depoimentos:              'Depoimentos',
    // Ferramentas
    relatorios:               'Relatórios',
    leads:                    'Leads',
    kanban:                   'Kanban de Leads',
    // Loja
    loja:                     'Loja',
    pdv:                      'PDV',
    pedidos:                  'Pedidos',
    // Secretaria
    secretaria:               'Secretaria Digital',
    // Sistema
    configuracoes:            'Configurações',
    // Legados / aliases
    agendamentos:             'Agendamentos',
    atendimentos:             'Atendimentos',
    matriculas:               'Pré-Matrículas',
    contatos:                 'Contatos',
    usuarios:                 'Usuários',
    segmentos:                'Segmentos',
  };

  // Nomes de sub-abas para páginas com ?tab=
  const SUB_TAB_LABELS: Record<string, Record<string, string>> = {
    configuracoes: {
      institutional: 'Institucional',
      academico:     'Acadêmico',
      visits:        'Agendamentos',
      attendance:    'Atendimentos',
      ferramentas:   'Ferramentas',
      fiscal:        'Fiscal (NF-e)',
      nfse:          'Fiscal (NFS-e)',
      audit:         'Auditoria',
      contact:       'Contatos',
      financial:     'Financeiro',
      enrollment:    'Matrícula',
      notifications: 'Notificações',
      permissions:   'Permissões',
      security:      'Segurança',
      site:          'Site',
      users:         'Usuários',
      whatsapp:      'WhatsApp',
    },
    gestao: {
      agendamentos: 'Agendamentos',
      atendimentos: 'Atendimentos',
      contatos:     'Contatos',
      matriculas:   'Matrícula',
      historico:    'Histórico',
    },
    financeiro: {
      dashboard:    'Visão Geral',
      plans:        'Planos',
      contracts:    'Contratos',
      installments: 'Cobranças',
      cash:         'Caixas',
      receivables:  'A Receber',
      payables:     'A Pagar',
      reports:      'Relatórios',
      discounts:    'Descontos',
      scholarships: 'Bolsas',
      templates:    'Templates',
      fornecedores: 'Fornecedores',
      nfse:         'NFS-e',
    },
    academico: {
      dashboard:      'Dashboard',
      alunos:         'Alunos',
      segmentos:      'Segmentos',
      disciplinas:    'Disciplinas',
      'grade-horaria':'Grade Horária',
      calendario:     'Calendário',
      boletim:        'Boletim',
      'resultado-final': 'Resultado Final',
      alertas:        'Alertas de Frequência',
      historico:      'Histórico Escolar',
      'ano-letivo':   'Ano Letivo',
      bncc:           'BNCC',
    },
    loja: {
      dashboard:   'Dashboard',
      produtos:    'Produtos',
      pedidos:     'Pedidos',
      pdv:         'PDV',
      relatorios:  'Relatórios',
    },
    secretaria: {
      declaracoes:    'Declarações',
      'fichas-saude': 'Fichas de Saúde',
      rematricula:    'Rematrícula',
      transferencias: 'Transferências',
    },
  };

  // Fallback: converte slug para título (ex: "area-professor" → "Area Professor")
  function toTitle(slug: string) {
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const lastSegment = segments[segments.length - 1] ?? '';
  const activeTab   = searchParams.get('tab');
  const subLabel    = activeTab ? SUB_TAB_LABELS[lastSegment]?.[activeTab] : undefined;

  return (
    <nav className="flex items-center gap-2 text-sm">
      <span className="text-gray-400">Admin</span>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const label  = PATH_LABELS[seg] ?? toTitle(seg);
        return (
          <span key={`${seg}-${i}`} className="flex items-center gap-2">
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className={isLast && !subLabel ? 'text-brand-primary dark:text-brand-secondary font-medium' : 'text-gray-400'}>
              {label}
            </span>
          </span>
        );
      })}
      {subLabel && (
        <span className="flex items-center gap-2">
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <span className="text-brand-primary dark:text-brand-secondary font-medium">{subLabel}</span>
        </span>
      )}
    </nav>
  );
}
