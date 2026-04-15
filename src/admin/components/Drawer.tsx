/**
 * Drawer — base reutilizável para painéis laterais deslizantes.
 *
 * Padrão visual extraído de "Editar motivo" (SettingsPage > Reason Drawer):
 *
 *  ┌─ header  bg-gradient from-brand-primary to-brand-primary-dark ─────┐
 *  │  [ícone] título + badge opcional      [extra] [fechar] │
 *  ├───────────────────────────────────────────────────────│
 *  │  body  bg-gray-50  overflow-y-auto  space-y-3          │
 *  │  └─ DrawerCard(s)                                      │
 *  │     ┌─ head  bg-gray-100  [ícone] TÍTULO ─────────┐   │
 *  │     ├─────────────────────────────────────────────│   │
 *  │     │  body  bg-white  children                   │   │
 *  │     └─────────────────────────────────────────────┘   │
 *  ├───────────────────────────────────────────────────────│
 *  │  footer (opcional)                                     │
 *  └───────────────────────────────────────────────────────┘
 *
 * Uso:
 *   <Drawer open={!!selected} onClose={() => setSelected(null)}
 *           title="Nome" icon={User} badge={<StatusBadge />}
 *           footer={<button>Salvar</button>}>
 *     <DrawerCard title="Seção" icon={Info}>
 *       …conteúdo…
 *     </DrawerCard>
 *   </Drawer>
 *
 * ── Padrão de footer ────────────────────────────────────────────
 *
 * SEM botão de exclusão (criar / editar simples):
 *
 *   <div className="flex gap-3">
 *     <button onClick={onClose} disabled={saving}
 *       className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
 *                  text-sm text-gray-600 dark:text-gray-300
 *                  hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
 *       Cancelar
 *     </button>
 *     <button onClick={handleSave} disabled={saving || !canSave}
 *       className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
 *                   text-sm font-medium transition-all
 *                   ${saved ? 'bg-emerald-500 text-white'
 *                           : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}>
 *       {saving ? <Loader2 className="w-4 h-4 animate-spin" />
 *        : saved  ? <Check className="w-4 h-4" />
 *                 : <ÍconeContextual className="w-4 h-4" />}
 *       {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Texto da ação'}
 *     </button>
 *   </div>
 *
 * COM botão de exclusão (edição com opção de deletar):
 *
 *   <div className="flex items-center gap-2">
 *     <button onClick={handleDelete} disabled={saving}
 *       className="px-4 py-2 text-sm font-medium rounded-xl
 *                  bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400
 *                  hover:bg-red-100 dark:hover:bg-red-900/40
 *                  transition-colors disabled:opacity-50 flex items-center gap-1.5">
 *       <Trash2 className="w-3.5 h-3.5" /> Excluir
 *     </button>
 *     <div className="flex-1" />
 *     <button onClick={onClose} disabled={saving}
 *       className="px-4 py-2 text-sm font-medium rounded-xl
 *                  border border-gray-200 dark:border-gray-600
 *                  text-gray-600 dark:text-gray-300
 *                  hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
 *       Cancelar
 *     </button>
 *     <button onClick={handleSave} disabled={saving || !canSave}
 *       className={`px-4 py-2 text-sm font-medium rounded-xl
 *                   transition-all flex items-center gap-2
 *                   ${saved ? 'bg-emerald-500 text-white'
 *                           : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}>
 *       {saving ? <Loader2 className="w-4 h-4 animate-spin" />
 *        : saved  ? <Check className="w-4 h-4" />
 *                 : <ÍconeContextual className="w-4 h-4" />}
 *       {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Texto da ação'}
 *     </button>
 *   </div>
 */

import { X } from 'lucide-react';

// ── DrawerCard ────────────────────────────────────────────────────────────────

export interface DrawerCardProps {
  /** Título exibido no cabeçalho cinza do card */
  title: string;
  /** Ícone Lucide opcional ao lado do título */
  icon?: React.ComponentType<{ className?: string }>;
  /** Conteúdo do corpo branco do card */
  children: React.ReactNode;
  /** Classes extras para o body (ex.: `'divide-y divide-gray-100'`) */
  bodyClassName?: string;
}

export function DrawerCard({ title, icon: Icon, children, bodyClassName }: DrawerCardProps) {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
      {/* Cabeçalho cinza */}
      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">
          {title}
        </span>
      </div>
      {/* Corpo branco */}
      <div className={`bg-white dark:bg-gray-900 px-4 py-4 space-y-3${bodyClassName ? ` ${bodyClassName}` : ''}`}>
        {children}
      </div>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export interface DrawerProps {
  /** Controla visibilidade. Quando false, nada é renderizado. */
  open: boolean;
  /** Chamado ao clicar no overlay ou no botão de fechar */
  onClose: () => void;
  /** Título exibido no cabeçalho azul */
  title: React.ReactNode;
  /** Ícone Lucide inline no título (sem container, estilo "Editar motivo") */
  icon?: React.ComponentType<{ className?: string }>;
  /** Badge de status ou outra pill ao lado do título */
  badge?: React.ReactNode;
  /** Botões/ações extras no canto direito do cabeçalho (antes do fechar) */
  headerExtra?: React.ReactNode;
  /** Rodapé fixo abaixo do body (botões de ação) */
  footer?: React.ReactNode;
  /** Largura do painel — padrão `w-[400px]` */
  width?: string;
  /** Conteúdo principal — normalmente um ou mais <DrawerCard> */
  children: React.ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  icon: Icon,
  badge,
  headerExtra,
  footer,
  width = 'w-[400px]',
  children,
}: DrawerProps) {
  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Painel */}
      <div
        className={`fixed right-0 top-0 h-full ${width} max-w-full bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col`}
      >
        {/* Cabeçalho azul */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-brand-primary to-brand-primary-dark flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 truncate">
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
              {title}
            </h3>
            {badge && <div className="flex-shrink-0">{badge}</div>}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {headerExtra}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-gray-900/60">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-gray-100 dark:border-gray-700 px-5 pt-4 pb-10 flex-shrink-0 bg-white dark:bg-gray-900">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
