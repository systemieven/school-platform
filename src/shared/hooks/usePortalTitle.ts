import { useEffect } from 'react';
import { useBranding } from '../../contexts/BrandingContext';

/**
 * Define document.title = "${title} | ${schoolName}".
 * Usado nos 3 portais (aluno/responsavel/professor) que nao passam por useSEO.
 * Reativo: atualiza quando o BrandingContext termina de carregar o school_name.
 */
export function usePortalTitle(title: string) {
  const { identity } = useBranding();
  const schoolName = identity.school_name || '';
  useEffect(() => {
    document.title = schoolName ? `${title} | ${schoolName}` : title;
  }, [title, schoolName]);
}
