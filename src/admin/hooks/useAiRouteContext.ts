import { useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

export interface AiRouteContext {
  module: string | null;
  entity_type: string | null;
  entity_id: string | null;
  tab: string | null;
  path: string;
}

const MODULE_BY_PREFIX: Array<[RegExp, string]> = [
  [/^\/admin\/academico/, 'academico'],
  [/^\/admin\/financeiro/, 'financeiro'],
  [/^\/admin\/secretaria/, 'secretaria'],
  [/^\/admin\/dashboard/, 'dashboard'],
  [/^\/admin\/loja/, 'loja'],
  [/^\/admin\/fornecedores/, 'fornecedores'],
  [/^\/admin\/configuracoes/, 'configuracoes'],
  [/^\/admin\/ia/, 'ia'],
  [/^\/admin\/portaria/, 'portaria'],
  [/^\/admin\/usuarios/, 'usuarios'],
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useAiRouteContext(): AiRouteContext {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const path = location.pathname;
    const module = MODULE_BY_PREFIX.find(([re]) => re.test(path))?.[1] ?? null;

    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? '';
    const entity_id = UUID_RE.test(lastSegment) ? lastSegment : null;
    const entity_type = entity_id ? segments[segments.length - 2] ?? null : null;

    return {
      module,
      entity_type,
      entity_id,
      tab: searchParams.get('tab'),
      path,
    };
  }, [location.pathname, searchParams]);
}
