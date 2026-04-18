/**
 * AdminBreadcrumbSearch — busca rápida de conteúdos de /admin.
 *
 * Fica encostado no breadcrumb (AdminHeader). Abre por clique no ícone de
 * lupa OU por atalho `Ctrl/Cmd+K`. Lista páginas + sub-abas para onde o
 * usuário logado tem permissão de `view`, com breadcrumb completo e link
 * direto (sub-abas recebem `?tab=X`).
 *
 * O índice vem de [buildSearchIndex](../lib/admin-search-index.ts), que
 * cruza `ADMIN_NAV` com os catálogos de sub-tabs e filtra pelo papel +
 * `canView()` do usuário. Como o índice é derivado dessas fontes, páginas
 * novas inseridas no menu aparecem aqui automaticamente.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, ChevronRight, X } from 'lucide-react';
import { usePermissions } from '../contexts/PermissionsContext';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { buildSearchIndex, rankSearch, type SearchEntry } from '../lib/admin-search-index';

export default function AdminBreadcrumbSearch() {
  const navigate = useNavigate();
  const { profile } = useAdminAuth();
  const { canView, loading } = usePermissions();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // ── Índice filtrado pelas permissões atuais ──
  // Recalcula só quando profile ou loading mudam — não deveria rodar em cada
  // tecla digitada, o ranking roda sobre o índice já materializado.
  const index = useMemo(
    () => buildSearchIndex(profile?.role, canView),
    [profile?.role, canView, loading],
  );

  const results = useMemo(() => rankSearch(index, query, 12), [index, query]);

  // ── Atalhos de teclado (Ctrl/Cmd+K global, setas dentro do popover) ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const shortcut = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (shortcut) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const chosen = results[activeIdx];
        if (chosen) go(chosen);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, activeIdx]);

  // ── Fechamento por clique externo ──
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
    }
  }, [open]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  function go(entry: SearchEntry) {
    setOpen(false);
    navigate(entry.path);
  }

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Buscar em /admin (Ctrl+K)"
        className="group flex items-center gap-2 w-64 lg:w-80 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors"
      >
        <Search className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
        {!open && (
          <span className="flex-1 flex items-center justify-center text-[12px] text-gray-500 dark:text-gray-400">
            <kbd className="text-[9px] font-mono bg-white dark:bg-gray-900 text-gray-500 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5">
              Ctrl K
            </kbd>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 w-[min(520px,calc(100vw-2rem))] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar páginas, abas, configurações…"
              className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Limpar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                Nada encontrado para "{query}"
              </div>
            ) : (
              results.map((entry, idx) => {
                const active = idx === activeIdx;
                return (
                  <button
                    key={entry.id}
                    onClick={() => go(entry)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`w-full text-left px-3 py-2 flex items-start gap-3 transition-colors ${
                      active
                        ? 'bg-brand-primary/8 dark:bg-brand-secondary/15'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      {/* Breadcrumb (Admin › Configurações › Site) */}
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 mb-0.5">
                        {entry.breadcrumb.map((crumb, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600" />}
                            <span className={i === entry.breadcrumb.length - 1 ? 'text-brand-primary dark:text-brand-secondary font-medium' : ''}>
                              {crumb}
                            </span>
                          </span>
                        ))}
                      </div>
                      {entry.hint && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{entry.hint}</p>
                      )}
                    </div>
                    {active && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-gray-400 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
            <span><kbd className="font-mono">↑↓</kbd> navegar</span>
            <span><kbd className="font-mono">↵</kbd> abrir</span>
            <span><kbd className="font-mono">Esc</kbd> fechar</span>
            <span className="ml-auto">{results.length} de {index.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
