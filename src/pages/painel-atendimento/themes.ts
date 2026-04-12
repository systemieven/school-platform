export interface PanelTheme {
  bg: string;
  text: string;
  accent: string;
  highlight: string;
  card: string;
  muted: string;
}

export const THEMES: Record<string, PanelTheme> = {
  'dark-blue': {
    bg: '#0a1628',
    text: '#ffffff',
    accent: 'var(--brand-primary)',
    highlight: 'var(--brand-secondary)',
    card: '#111d33',
    muted: '#94a3b8',
  },
  'dark-green': {
    bg: '#0a1a0a',
    text: '#ffffff',
    accent: '#166534',
    highlight: '#86efac',
    card: '#112211',
    muted: '#94a3b8',
  },
  'dark-gold': {
    bg: '#1a1400',
    text: '#ffffff',
    accent: '#92700c',
    highlight: 'var(--brand-secondary)',
    card: '#221c05',
    muted: '#b0a47a',
  },
  light: {
    bg: '#f8fafc',
    text: '#1e293b',
    accent: 'var(--brand-primary)',
    highlight: 'var(--brand-secondary)',
    card: '#ffffff',
    muted: '#64748b',
  },
};

export const SOUND_FILES: Record<string, string> = {
  bell:   '/sounds/attendance-bell.mp3',
  chime:  '/sounds/attendance-chime.mp3',
  ding:   '/sounds/attendance-ding.mp3',
  buzzer: '/sounds/attendance-buzzer.mp3',
};
