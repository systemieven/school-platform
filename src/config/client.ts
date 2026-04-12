/**
 * Client Defaults — Single source of truth for per-client fallback values.
 *
 * These are used ONLY when the database (system_settings) has not yet loaded
 * or doesn't contain the corresponding key.  In production, the admin panel
 * writes the real values into system_settings and they take precedence.
 *
 * For multi-client deployments, override via VITE_* env vars in each
 * client's .env file.
 */

export const CLIENT_DEFAULTS = {
  identity: {
    school_name:       import.meta.env.VITE_SCHOOL_NAME       || 'Minha Escola',
    school_short_name: import.meta.env.VITE_SCHOOL_SHORT_NAME || 'Escola',
    school_initials:   import.meta.env.VITE_SCHOOL_INITIALS   || 'ME',
    slogan:            import.meta.env.VITE_SCHOOL_SLOGAN     || '',
    cnpj: '',
  },

  portal: {
    email_suffix: import.meta.env.VITE_PORTAL_EMAIL_SUFFIX || '@portal.escola.local',
  },

  colors: {
    primary:          '#003366',
    primary_dark:     '#002244',
    secondary:        '#ffd700',
    secondary_light:  '#ffe44d',
    surface:          '#f8f7f4',
    surface_warm:     '#f3f1ec',
    text_on_primary:  '#ffffff',
    text_on_secondary:'#1a1a2e',
  },

  fonts: {
    display_family: 'Inter',
    display_weight: '700',
    sans_family:    'Inter',
    sans_weight:    '400',
    admin_family:   'Inter',
    google_fonts_url:
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  },

  cta: {
    enrollment_label:      'Matrícula',
    enrollment_route:      '/matricula',
    enrollment_pulse:      true,
    hero_primary_label:    'Conheça Nossa Escola',
    hero_primary_route:    '/sobre',
    hero_secondary_label:  'Agende uma Visita',
    hero_secondary_route:  '/agendar-visita',
    band_label:            'Faça sua matrícula',
    band_route:            '/matricula',
  },
} as const;
