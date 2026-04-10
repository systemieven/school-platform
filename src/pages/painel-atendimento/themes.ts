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
    accent: '#003876',
    highlight: '#ffd700',
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
  'dark-red': {
    bg: '#1a0a0a',
    text: '#ffffff',
    accent: '#991b1b',
    highlight: '#fca5a5',
    card: '#221111',
    muted: '#94a3b8',
  },
  light: {
    bg: '#f8fafc',
    text: '#1e293b',
    accent: '#003876',
    highlight: '#ffd700',
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
