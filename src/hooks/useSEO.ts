import { useEffect } from 'react';
import { useBranding } from '../contexts/BrandingContext';
import { useSettings } from './useSettings';

// ── Types ──

export interface PageSEO {
  title: string;
  description: string;
  og_image?: string;
  /** Override og:type (default "website") */
  og_type?: string;
  /** Extra keywords for <meta name="keywords"> */
  keywords?: string;
  /** Canonical path override (e.g. "/educacao-infantil") */
  canonical?: string;
  /** noindex flag */
  noindex?: boolean;
}

// ── Default per-page SEO data ──

const PAGE_DEFAULTS: Record<string, PageSEO> = {
  home: {
    title: '',  // Uses school name directly
    description: '',
  },
  educacao_infantil: {
    title: 'Educação Infantil',
    description: 'Ambiente acolhedor e estimulante para o desenvolvimento integral do seu filho de 2 a 5 anos.',
  },
  fundamental_1: {
    title: 'Ensino Fundamental I',
    description: 'Bases sólidas para o futuro através de uma educação integral e inovadora.',
  },
  fundamental_2: {
    title: 'Ensino Fundamental II',
    description: 'Preparando jovens para os desafios do futuro com excelência acadêmica e valores sólidos.',
  },
  ensino_medio: {
    title: 'Ensino Médio',
    description: 'Excelência acadêmica e preparação completa para o sucesso no ENEM e vestibulares.',
  },
  matricula: {
    title: 'Matrícula',
    description: 'Garanta a vaga do seu filho em uma escola comprometida com a excelência.',
  },
  contato: {
    title: 'Contato',
    description: 'Tire suas dúvidas, agende uma visita ou solicite informações sobre matrículas.',
  },
  agendar_visita: {
    title: 'Agende sua Visita',
    description: 'Conheça pessoalmente nossa estrutura, equipe pedagógica e tudo que temos a oferecer.',
  },
  politica_privacidade: {
    title: 'Política de Privacidade',
    description: 'Saiba como coletamos, usamos e protegemos seus dados pessoais.',
    noindex: true,
  },
  termos_uso: {
    title: 'Termos de Uso',
    description: 'Termos e condições de uso do nosso site.',
    noindex: true,
  },
  sobre: {
    title: 'Sobre Nós',
    description: 'Conheça a história, missão, visão e valores. Mais de 20 anos de tradição em educação.',
  },
  estrutura: {
    title: 'Estrutura',
    description: 'Conheça os espaços modernos e acolhedores: salas, laboratórios, quadras e muito mais.',
  },
};

// ── Meta tag helpers ──

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (el) {
    el.content = content;
  } else {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    el.content = content;
    document.head.appendChild(el);
  }
}

function removeMeta(name: string, attr: 'name' | 'property' = 'name') {
  const el = document.querySelector(`meta[${attr}="${name}"]`);
  if (el) el.remove();
}

// ── Hook ──

/**
 * Sets document title and meta tags for the current page.
 *
 * @param pageKey - Key matching system_settings seo category (e.g. "home", "educacao_infantil")
 * @param overrides - Optional runtime overrides (e.g. dynamic content)
 */
export function useSEO(pageKey: string, overrides?: Partial<PageSEO>) {
  const { identity } = useBranding();
  const { settings: seoSettings } = useSettings('seo');

  const schoolName = identity.school_name || '';
  // Stabilize overrides to avoid infinite re-renders when passed inline
  const overridesKey = overrides ? JSON.stringify(overrides) : '';

  useEffect(() => {
    const parsedOverrides = overridesKey ? JSON.parse(overridesKey) as Partial<PageSEO> : undefined;
    // Merge: defaults → DB settings → runtime overrides
    const defaults = PAGE_DEFAULTS[pageKey] || { title: '', description: '' };
    const dbPage = (seoSettings[pageKey] as Partial<PageSEO> | undefined) ?? {};
    const seo: PageSEO = { ...defaults, ...dbPage, ...parsedOverrides };

    // ── Title ──
    const pageTitle = seo.title;
    const fullTitle = pageTitle
      ? `${pageTitle} | ${schoolName}`
      : schoolName;
    document.title = fullTitle;

    // ── Description ──
    const desc = seo.description || defaults.description;
    setMeta('description', desc);

    // ── Open Graph ──
    setMeta('og:title', fullTitle, 'property');
    setMeta('og:description', desc, 'property');
    setMeta('og:type', seo.og_type || 'website', 'property');

    const ogImage = seo.og_image || identity.og_image_url;
    if (ogImage) {
      setMeta('og:image', ogImage, 'property');
    }

    // ── Twitter Card ──
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', desc);
    if (ogImage) {
      setMeta('twitter:image', ogImage);
    }

    // ── Keywords ──
    if (seo.keywords) {
      setMeta('keywords', seo.keywords);
    }

    // ── Robots ──
    if (seo.noindex) {
      setMeta('robots', 'noindex, nofollow');
    } else {
      removeMeta('robots');
    }

    // Cleanup: restore generic title on unmount
    return () => {
      document.title = schoolName;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, schoolName, seoSettings, identity.og_image_url, overridesKey]);
}
