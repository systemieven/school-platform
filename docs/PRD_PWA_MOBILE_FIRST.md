# PRD — PWA & Mobile-First
## Fase 13 · Plataforma Escolar

> **Versão**: 1.0  
> **Data**: 14 de abril de 2026  
> **Complementa**: PRD v2.1 + PRD ERP Complementar  
> **Princípio central**: Uma única base de código. Cada área do app detecta o contexto de tela e entrega a experiência nativa correspondente — sem abrir mão de nenhuma funcionalidade.

---

## Índice

1. [Visão Estratégica](#1-visão-estratégica)
2. [PWA — Infraestrutura](#2-pwa--infraestrutura)
3. [Sistema de Breakpoints e Contexto de Tela](#3-sistema-de-breakpoints-e-contexto-de-tela)
4. [Primitivas de UI Adaptativas](#4-primitivas-de-ui-adaptativas)
5. [Área: Site Institucional](#5-área-site-institucional)
6. [Área: Admin Panel](#6-área-admin-panel)
7. [Área: Portal do Aluno](#7-área-portal-do-aluno)
8. [Área: Portal do Responsável](#8-área-portal-do-responsável)
9. [Área: Atendimento Presencial](#9-área-atendimento-presencial)
10. [Módulos com Padrões Específicos](#10-módulos-com-padrões-específicos)
11. [Interações Touch e Gestos](#11-interações-touch-e-gestos)
12. [Tipografia e Espaçamento Adaptativo](#12-tipografia-e-espaçamento-adaptativo)
13. [Performance Mobile](#13-performance-mobile)
14. [Implementação — Sequência de Desenvolvimento](#14-implementação--sequência-de-desenvolvimento)
15. [Checklist de Qualidade Mobile](#15-checklist-de-qualidade-mobile)

---

## 1. Visão Estratégica

### Por que esta fase é crítica

O sistema tem cinco áreas com perfis de usuário completamente diferentes:

| Área | Usuário típico | Dispositivo primário | Contexto de uso |
|------|--------------|---------------------|-----------------|
| **Site institucional** | Pai prospectando escola | 📱 Smartphone | No trânsito, pesquisando |
| **Admin panel** | Secretária / coordenador | 🖥️ Desktop | Mesa de trabalho |
| **Portal do Aluno** | Estudante 10–18 anos | 📱 Smartphone | Casa, intervalo, transporte |
| **Portal do Responsável** | Pai / mãe 30–50 anos | 📱 Smartphone | Qualquer momento |
| **Atendimento** | Visitante na recepção | 📱 Smartphone (QR) | Na fila, em pé |

O admin é o único contexto onde o desktop é primário. Todas as outras áreas têm o smartphone como dispositivo dominante — e o admin cada vez mais é acessado em tablet por coordenadores e em celular por professores registrando frequência.

### O princípio da equivalência funcional

Não existe "versão mobile" com menos recursos. Existe **o mesmo sistema com interface adaptada ao contexto**. Um professor que esqueceu de lançar frequência às 22h no celular tem acesso à mesma funcionalidade que teria no desktop às 8h. Um pai que quer ver o boletim do filho no celular vê exatamente os mesmos dados com uma UX otimizada para toque.

### O que muda entre desktop e mobile

```
NÃO muda:          MUDA:
─────────────      ──────────────────────────────────────────
Dados               Navegação: sidebar → bottom nav
Funcionalidades     Tabelas: grid → cards empilhados
Permissões          Modais: centered modal → bottom sheet
Fluxos              Drawers: lateral → full screen
WhatsApp            Filtros: inline → fab + bottom sheet
                    Formulários: campos lado a lado → empilhados
                    Ações: botões no header → FAB + action sheet
                    Tabs: barra horizontal → scroll snap + indicador
```

---

## 2. PWA — Infraestrutura

### 2.1 Web App Manifest

Cada área do app tem seu próprio `manifest.json` para permitir instalação independente:

```json
// public/manifest.json (site + fallback geral)
{
  "name": "{{school_name}}",
  "short_name": "{{school_short_name}}",
  "description": "Portal da {{school_name}}",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "{{branding.colors.primary}}",
  "theme_color": "{{branding.colors.primary}}",
  "icons": [
    { "src": "{{branding.identity.favicon_url}}", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "{{branding.identity.favicon_url}}", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "screenshots": [],
  "categories": ["education"],
  "lang": "pt-BR",
  "dir": "ltr"
}
```

```json
// public/manifest.portal.json (Portal do Aluno — instalação separada)
{
  "name": "Portal do Aluno — {{school_short_name}}",
  "short_name": "Portal",
  "start_url": "/portal",
  "display": "standalone",
  "orientation": "portrait",
  "scope": "/portal",
  "background_color": "{{branding.colors.primary}}",
  "theme_color": "{{branding.colors.primary}}"
}
```

```json
// public/manifest.responsavel.json (Portal do Responsável)
{
  "name": "Portal do Responsável — {{school_short_name}}",
  "short_name": "Responsável",
  "start_url": "/responsavel",
  "display": "standalone",
  "scope": "/responsavel",
  "orientation": "portrait"
}
```

> **Importante**: Os valores `{{variáveis}}` são substituídos dinamicamente pelo `BrandingProvider` existente (já implementado na Fase 7). A Edge Function `generate-manifest` serve os arquivos com os valores do `system_settings` do tenant.

### 2.2 Service Worker

**Stack**: Vite PWA plugin (`vite-plugin-pwa`) + Workbox 7

**Estratégia de cache por tipo de recurso**:

```typescript
// vite.config.ts — configuração do VitePWA

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

    runtimeCaching: [
      // Assets estáticos do branding (logo, favicon) — Cache First
      {
        urlPattern: /\/site-images\/.*/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'branding-images',
          expiration: { maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 }
        }
      },

      // API Supabase — Network First com fallback
      {
        urlPattern: /supabase\.co\/rest\/.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-api',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 100, maxAgeSeconds: 5 * 60 }
        }
      },

      // system_settings (branding, config) — Stale While Revalidate
      {
        urlPattern: ({ url }) => url.pathname.includes('system_settings'),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'app-config',
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 }
        }
      },

      // Google Fonts — Cache First (raramente muda)
      {
        urlPattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: { maxAgeSeconds: 365 * 24 * 60 * 60 }
        }
      }
    ]
  }
})
```

### 2.3 Offline Experience

**O que funciona offline** (dados previamente cacheados):

| Área | Offline capability |
|------|-------------------|
| Site institucional | ✅ Página inicial e informações institucionais (cache) |
| Admin | ⚠️ Visualização de dados já carregados; ações bloqueadas com aviso |
| Portal do Aluno | ✅ Notas e atividades da última sessão; ❌ sem dados novos |
| Portal do Responsável | ✅ Parcelas e comunicados da última sessão |
| Atendimento (QR check-in) | ❌ Requer conexão (fila em tempo real) |

**Banner de status de conexão** (componente global):

```tsx
// src/components/ui/OfflineBanner.tsx
// Exibido no topo de todas as áreas quando navigator.onLine === false

<div role="alert" className="offline-banner">
  <WifiOff size={14} />
  <span>Sem conexão — exibindo dados salvos</span>
</div>
```

### 2.4 Instalabilidade

**Prompt de instalação nativo** — aparece após o usuário:
1. Ter visitado o Portal do Aluno ou Portal do Responsável pelo menos 2 vezes
2. Ter passado pelo menos 30 segundos na sessão atual
3. Não ter dispensado o prompt nas últimas 2 semanas

**Componente `InstallPrompt`**:
- Aparece como **bottom sheet** no mobile
- Ícone do app + nome da escola + botão "Instalar" e "Agora não"
- Armazena estado em `localStorage` para controlar frequência

### 2.5 Meta Tags e iOS

O Safari (iOS) não suporta PWA manifest completo. Compensações necessárias no `index.html`:

```html
<!-- iOS PWA Meta Tags -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="{{school_short_name}}">
<link rel="apple-touch-icon" href="{{favicon_url}}">

<!-- Splash screens iOS (gerados dinamicamente) -->
<link rel="apple-touch-startup-image" href="/splash-1125x2436.png" media="...">

<!-- Prevent zoom on input focus (iOS) -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">

<!-- Theme color para Android Chrome -->
<meta name="theme-color" content="{{branding.colors.primary}}">

<!-- Safe areas (notch, home indicator) -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### 2.6 Safe Areas (notch e home indicator)

```css
/* src/styles/safe-areas.css */

:root {
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-right:  env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left:   env(safe-area-inset-left, 0px);
}

/* Aplicado em todos os navbars superiores */
.top-bar {
  padding-top: calc(1rem + var(--safe-top));
}

/* Aplicado em todas as bottom navbars */
.bottom-nav {
  padding-bottom: calc(0.5rem + var(--safe-bottom));
  height: calc(4rem + var(--safe-bottom));
}

/* Aplicado em bottom sheets */
.bottom-sheet {
  padding-bottom: calc(1.5rem + var(--safe-bottom));
}
```

---

## 3. Sistema de Breakpoints e Contexto de Tela

### 3.1 Breakpoints definidos

```typescript
// src/hooks/useBreakpoint.ts

export const BREAKPOINTS = {
  xs:  0,     // < 360px — smartphones pequenos (iPhone SE)
  sm:  360,   // ≥ 360px — smartphones normais
  md:  768,   // ≥ 768px — tablets portrait
  lg:  1024,  // ≥ 1024px — tablets landscape / desktop pequeno
  xl:  1280,  // ≥ 1280px — desktop
  '2xl': 1536 // ≥ 1536px — desktop grande
} as const

export type Breakpoint = keyof typeof BREAKPOINTS
```

### 3.2 Hook de contexto de tela

```typescript
// src/hooks/useScreen.ts

export interface ScreenContext {
  // Flags booleanas
  isMobile:  boolean  // < 768px
  isTablet:  boolean  // 768–1023px
  isDesktop: boolean  // ≥ 1024px

  // Breakpoint atual
  breakpoint: Breakpoint

  // Capacidades de toque
  hasTouch: boolean
  isStandalone: boolean  // instalado como PWA

  // Orientação
  isPortrait:  boolean
  isLandscape: boolean

  // Dimensões
  width:  number
  height: number
}

export function useScreen(): ScreenContext {
  const [state, setState] = useState<ScreenContext>(computeState())

  useEffect(() => {
    const handler = debounce(() => setState(computeState()), 100)
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
    }
  }, [])

  return state
}

function computeState(): ScreenContext {
  const w = window.innerWidth
  return {
    isMobile:    w < 768,
    isTablet:    w >= 768 && w < 1024,
    isDesktop:   w >= 1024,
    breakpoint:  getBreakpoint(w),
    hasTouch:    'ontouchstart' in window || navigator.maxTouchPoints > 0,
    isStandalone: window.matchMedia('(display-mode: standalone)').matches,
    isPortrait:  window.innerHeight > window.innerWidth,
    isLandscape: window.innerWidth >= window.innerHeight,
    width:  w,
    height: window.innerHeight
  }
}
```

### 3.3 Tailwind — extensão dos breakpoints

```javascript
// tailwind.config.ts
module.exports = {
  theme: {
    screens: {
      'xs':  '360px',
      'sm':  '640px',
      'md':  '768px',
      'lg':  '1024px',
      'xl':  '1280px',
      '2xl': '1536px',
      // Atalhos semânticos
      'mobile':  { max: '767px' },
      'tablet':  { min: '768px', max: '1023px' },
      'desktop': { min: '1024px' },
      'touch':   { raw: '(hover: none) and (pointer: coarse)' },
      'standalone': { raw: '(display-mode: standalone)' },
    }
  }
}
```

---

## 4. Primitivas de UI Adaptativas

Estas são as peças fundamentais que mudam de comportamento entre desktop e mobile. Cada módulo as usa diretamente — sem reimplementar a lógica de adaptação.

### 4.1 AdaptiveModal

**Desktop**: Modal centralizado com backdrop  
**Mobile**: Bottom sheet com handle, drag para fechar, animação spring

```tsx
// src/components/ui/AdaptiveModal.tsx

interface AdaptiveModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  children: React.ReactNode
  // Mobile-specific
  snapPoints?: number[]       // ex: [0.4, 0.9] — 40% e 90% da tela
  initialSnap?: number        // índice do snapPoint inicial
  showHandle?: boolean        // arraste visual no topo (default: true no mobile)
  preventClose?: boolean      // impede fechar arrastando (para formulários críticos)
}

// Desktop: <Dialog> centrado com max-w-{size}
// Mobile: <BottomSheet> com framer-motion drag constraint + snap points

// Animação mobile:
const mobileVariants = {
  hidden:  { y: '100%' },
  visible: { y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
  exit:    { y: '100%', transition: { duration: 0.2 } }
}
```

**Snap points para bottom sheet**:
```
snapPoint: 0.35 → formulário simples, confirmações, alerts
snapPoint: 0.65 → formulários médios, detalhes de registro
snapPoint: 0.90 → formulários complexos, listas detalhadas
snapPoint: 1.0  → tela cheia (substitui rotas de detalhe)
```

### 4.2 AdaptiveDrawer

**Desktop**: Lateral deslizante (direita ou esquerda) com overlay  
**Mobile**: Full screen com header próprio e botão voltar nativo

```tsx
// src/components/ui/AdaptiveDrawer.tsx

interface AdaptiveDrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  side?: 'left' | 'right'   // desktop only
  width?: string             // desktop: '400px', '560px', etc.
  children: React.ReactNode
  footer?: React.ReactNode   // rodapé com botões de ação
}

// Mobile: página full screen com:
// - Header: [← Voltar] [Título] [Ação primária]
// - Body: scroll vertical
// - Footer: sticky no bottom com botões

// Desktop: drawer lateral com:
// - Header no topo do drawer
// - Body: scroll interno
// - Footer: sticky no fundo do drawer
```

### 4.3 AdaptiveTable

**Desktop**: Tabela HTML com colunas configuráveis  
**Mobile**: Lista de cards empilhados, cada linha = um card

```tsx
// src/components/ui/AdaptiveTable.tsx

interface Column<T> {
  key: keyof T
  header: string
  cell?: (row: T) => React.ReactNode

  // Controle mobile
  mobileVisible?: boolean        // mostrar no card mobile? (default: true)
  mobilePrimary?: boolean        // destacar como título do card
  mobileSecondary?: boolean      // segunda linha do card
  mobileHide?: boolean           // ocultar no mobile (sem perder dado)
}

interface AdaptiveTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  actions?: (row: T) => React.ReactNode   // desktop: coluna de ações / mobile: swipe actions
  emptyState?: React.ReactNode
  isLoading?: boolean
  // Mobile card customization
  mobileCardHeader?: (row: T) => React.ReactNode
  mobileCardActions?: (row: T) => React.ReactNode
}

// Card mobile gerado automaticamente:
// ┌──────────────────────────────────────────┐
// │ [Avatar/Icon]  TITULO PRIMÁRIO    [Badge]│
// │               Linha secundária           │
// │               Linha terciária            │
// │ [Ação 1]                      [Ação 2]  │
// └──────────────────────────────────────────┘
```

### 4.4 AdaptiveTabs

**Desktop**: Barra de abas horizontal, todas visíveis  
**Mobile**: Scroll horizontal com snap, aba ativa centralizada, indicador animado

```tsx
// src/components/ui/AdaptiveTabs.tsx

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode       // mostrado no mobile quando label longo
  badge?: number | string
}

interface AdaptiveTabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
  // Desktop: posição das tabs
  desktopVariant?: 'line' | 'pills' | 'boxed'
  // Mobile: comportamento
  mobileVariant?: 'scroll' | 'fixed'  // fixed = até 4 tabs, scroll = 5+
}

// CSS para scroll com snap:
// overflow-x: scroll; scroll-snap-type: x mandatory
// .tab { scroll-snap-align: center }
```

### 4.5 FAB (Floating Action Button)

Substitui botões de "Nova ação" que ficam no header em desktop:

```tsx
// src/components/ui/FAB.tsx

interface FABProps {
  icon: React.ReactNode
  label: string            // tooltip no desktop, label visível no mobile
  onClick: () => void
  variant?: 'primary' | 'secondary'
  position?: 'bottom-right' | 'bottom-center'
  // Multiple actions (FAB expandido)
  actions?: Array<{
    icon: React.ReactNode
    label: string
    onClick: () => void
  }>
}

// Posicionamento:
// bottom: calc(4rem + var(--safe-bottom) + 1rem)  ← acima da bottom nav
// right: 1rem
// z-index: 40
```

### 4.6 SwipeActions

Ações que aparecem ao deslizar um card para a esquerda (padrão iOS):

```tsx
// src/components/ui/SwipeActions.tsx

interface SwipeAction {
  label: string
  icon: React.ReactNode
  color: 'danger' | 'warning' | 'success' | 'primary'
  onTrigger: () => void
  fullSwipe?: boolean  // swipe completo executa a ação automaticamente
}

interface SwipeActionsProps {
  leftActions?: SwipeAction[]   // reveladas ao deslizar direita
  rightActions?: SwipeAction[]  // reveladas ao deslizar esquerda
  children: React.ReactNode
}

// Só ativo no mobile (useScreen().isMobile)
// No desktop, as ações aparecem no hover da linha
```

### 4.7 BottomNav

```tsx
// src/components/ui/BottomNav.tsx

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  activeIcon?: React.ReactNode  // ícone preenchido quando ativo
  href: string
  badge?: number                // ponto vermelho com número
}

interface BottomNavProps {
  items: NavItem[]              // máximo 5 itens
  activeItem: string
}

// Estrutura:
// ┌──────────────────────────────────────────────────────────┐
// │  [Ícone]    [Ícone●]   [Ícone]    [Ícone]    [Ícone]   │
// │  Label      Label      Label      Label      Label      │
// └────────────────── padding-bottom: safe-bottom ──────────┘

// Animação de transição entre itens: translate do indicador ativo
```

### 4.8 PullToRefresh

```tsx
// src/components/ui/PullToRefresh.tsx
// Wrapped ao redor do conteúdo principal de cada lista/página

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
}

// Ativa somente em mobile e quando a página está no topo
// Threshold: 80px de pull → trigger
// Indicador: spinner animado que aparece ao puxar
// Só ativo em mobile (touch) — desktop não precisa
```

### 4.9 ActionSheet

Alternativa mobile ao dropdown de ações:

```tsx
// src/components/ui/ActionSheet.tsx
// Desktop: dropdown menu padrão
// Mobile: bottom sheet com lista de ações

interface Action {
  label: string
  icon?: React.ReactNode
  variant?: 'default' | 'danger'
  onTrigger: () => void
}

interface ActionSheetProps {
  actions: Action[]
  title?: string
  cancelLabel?: string
  trigger: React.ReactNode
}
```

---

## 5. Área: Site Institucional

**Contexto**: Pais e interessados buscando informações sobre a escola. Mais de 70% do tráfego é mobile.

### 5.1 Navegação Mobile

**Desktop atual**: Navbar horizontal com logo + menu + CTA  
**Mobile novo**: Navbar compacta + menu hamburger → drawer lateral

```
Mobile Navbar:
┌──────────────────────────────────┐
│ [Logo]          [☎] [≡ Menu]    │
└──────────────────────────────────┘

Drawer (ao abrir ≡):
┌──────────────────────────────────┐
│ [✕]        Colégio Batista       │
├──────────────────────────────────┤
│ 🏠 Início                        │
│ 📚 Segmentos          [›]        │
│    Educação Infantil             │
│    Fund. I / Fund. II            │
│    Ensino Médio                  │
│ ℹ️  Sobre                         │
│ 🏛️  Estrutura                    │
│ 📞 Contato                       │
├──────────────────────────────────┤
│ [Agendar Visita]                 │
│ [Fazer Matrícula]  ← destaque    │
└──────────────────────────────────┘
```

**Comportamento do menu**:
- Animação: slide from left (280px) com backdrop blur
- Submenu de Segmentos: expand/collapse inline (não sub-drawer)
- Backdrop tap: fecha o menu
- Scroll no conteúdo: fecha o menu

### 5.2 Hero e Formulários

**Hero Slideshow mobile**:
- Altura: `100svh` (small viewport height — ignora barra do browser)
- CTAs empilhados verticalmente
- Texto centralizado (não alinhado à esquerda)
- Cenas: swipe horizontal natural entre slides
- Indicadores de slide: dots ao invés de barra

**Formulário de Matrícula mobile**:
- Campos sempre em coluna única (nunca dois por linha)
- Labels acima dos campos (nunca floating/placeholder)
- Input type semântico: `tel`, `email`, `date`, `number`
- Teclado numérico para CPF, telefone, CEP
- Upload de documentos: câmera nativa + galeria
- Passo a passo: wizard de 4 etapas com progress bar no topo

**Formulário de Agendamento mobile**:
- Calendário: carousel horizontal de dias (scroll snap)
- Horários: grid 2 colunas de chips selecionáveis
- CTA "Confirmar" sticky no bottom

### 5.3 Páginas de Segmento mobile

- Seções colapsáveis com accordion
- Cards de diferenciais: scroll horizontal (não grade)
- Depoimentos: carousel com swipe
- Galeria de fotos: grade 2×N com lightbox nativo
- CTA sticky no bottom: "Agendar visita" / "Fazer matrícula"

---

## 6. Área: Admin Panel

**Contexto**: Desktop-first — mas com suporte completo para uso em tablet (coordenadores em reunião) e acesso eventual em smartphone (professor registrando frequência).

### 6.1 Layout Adaptativo

```
Desktop (≥ 1024px):              Tablet (768–1023px):
┌────────────┬──────────────┐    ┌─────────────────────┐
│  Sidebar   │  Conteúdo   │    │  Conteúdo           │
│  (240px)   │             │    │  (full width)       │
└────────────┴──────────────┘    └─────────────────────┘
                                 + Hamburger no header
                                 → Drawer lateral (240px)

Mobile (< 768px):
┌─────────────────────────┐
│  [≡]  Painel Admin  [🔔]│
├─────────────────────────┤
│                         │
│  Conteúdo               │
│  (full width)           │
│                         │
├─────────────────────────┤
│ 🏠  📋  ✏️  👥  ⚙️     │  ← Bottom nav (5 itens)
└─────────────────────────┘
```

### 6.2 Sidebar → Bottom Navigation (Mobile)

A sidebar com 17 rotas não cabe no mobile. Mapeamento para bottom nav + overflow:

**Bottom Nav — 5 itens principais** (configuráveis por role):

| Role | Item 1 | Item 2 | Item 3 | Item 4 | Item 5 |
|------|--------|--------|--------|--------|--------|
| Admin | Dashboard | Matrículas | Agenda | Alunos | Mais |
| Coordenador | Dashboard | Turmas | Alunos | Comunicados | Mais |
| Professor | Minhas Turmas | Freq./Notas | Atividades | Comunicados | Mais |

**Item "Mais" → Bottom Sheet** com os demais módulos:

```
┌────────────────────────────────────────────┐
│ ▬                                          │
│ TODAS AS SEÇÕES                            │
├────────────────────────────────────────────┤
│ 🎯 Leads / Kanban                          │
│ 📊 Relatórios                              │
│ 📚 Biblioteca                              │
│ 🎪 Eventos                                 │
│ 💳 Financeiro                              │
│ ⚙️  Configurações                          │
└────────────────────────────────────────────┘
```

### 6.3 Dashboard Mobile

**Desktop**: Grade de 4 métricas + gráficos lado a lado  
**Mobile**: Scroll vertical de cards empilhados

```
Mobile Dashboard:
┌──────────────────────────────┐
│ Bom dia, Maria Clara ☀️       │
│ Segunda, 13 de abril         │
├──────────────────────────────┤
│ ┌────────┐  ┌────────┐       │
│ │  12    │  │  3     │       │
│ │Matrícul│  │Contatos│       │
│ │ hoje   │  │ s/ resp│       │
│ └────────┘  └────────┘       │
├──────────────────────────────┤
│ ┌────────────────────────┐   │
│ │  Pipeline de Matrículas│   │
│ │  [gráfico barras horiz]│   │
│ └────────────────────────┘   │
├──────────────────────────────┤
│ PRÓXIMOS AGENDAMENTOS        │
│ ┌───────────────────────┐    │
│ │ João Silva · 14:00    │    │
│ │ Visita · Fund. II     │    │
│ └───────────────────────┘    │
└──────────────────────────────┘
```

### 6.4 Listas (Matrículas, Contatos, Agendamentos)

**Desktop**: Tabela com filtros em linha, ações na coluna direita  
**Mobile**: Cards com swipe actions + FAB para nova entrada + filtros via FAB secundário

```
Mobile — Lista de Matrículas:
┌──────────────────────────────────┐
│ [← ]  Matrículas  [🔍] [⊞ Filtro]│
├──────────────────────────────────┤
│ ← deslize para ações →           │
│ ┌──────────────────────────────┐ │
│ │ João Pedro Santos            │ │
│ │ Fund. II · CPF: ••• 789-00  │ │
│ │ ⏳ Em análise · 2 dias      │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ Ana Beatriz Lima             │ │
│ │ Ed. Infantil · CPF: ••• 123 │ │
│ │ 📄 Docs pendentes · 5 dias  │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
                              [+ FAB]

Swipe left em um card:
┌────────────────┬──────────┬──────────┐
│  card content  │ 💬 Msg   │ ✏️ Editar│
└────────────────┴──────────┴──────────┘
```

### 6.5 Detalhe de Registro

**Desktop**: Drawer lateral 560px ou modal  
**Mobile**: AdaptiveDrawer → full screen com header e footer sticky

```
Mobile — Detalhe de Matrícula (full screen):
┌──────────────────────────────────────────┐
│ [←] João Pedro Santos     [💬 WhatsApp]  │
├──────────────────────────────────────────┤
│ STATUS: ⏳ EM ANÁLISE                    │
│ [Aprovar docs] [Solicitar docs] [Arquivar]│
├──────────────────────────────────────────┤
│ INFORMAÇÕES                              │
│ Responsável: Maria Santos               │
│ CPF: 123.456.789-00                     │
│ Telefone: (81) 99999-1234               │
├──────────────────────────────────────────┤
│ [scroll continua...]                     │
├──────────────────────────────────────────┤
│ TIMELINE                                 │
│ ┌ Hoje 14:32 — Em análise               │
│ ├ Ontem 09:00 — Recebido                │
│ └ 10/04 08:45 — Criado (site)           │
└──────────────────────────────────────────┘
│ [Enviar WhatsApp]    [Mudar status ▼]   │  ← footer sticky
└──────────────────────────────────────────┘
```

### 6.6 Área do Professor Mobile

Esta é a rota mais usada em smartphone. Prioridade máxima de otimização.

**Tab navigation mobile** (scroll horizontal):
```
[Visão Geral] [Frequência] [Notas] [Atividades] [Materiais]
     ▲── ativo ──▲
```

**Registro de frequência mobile**:

```
┌──────────────────────────────────────┐
│ [←] 7º Ano A — Português            │
│ Quinta, 13 de abril de 2026         │
├──────────────────────────────────────┤
│ [✓ Todos presentes]  [Salvar rápido] │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ 🟢  Ana Beatriz Costa            │ │  ← tap muda status
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 🔴  Carlos Eduardo Silva         │ │  ← vermelho = falta
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 🟡  Daniela Fernandes            │ │  ← amarelo = justificada
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
│              [💾 Salvar Chamada]      │  ← sticky footer
└──────────────────────────────────────┘
```

Status cycling ao tocar: ✅ Presente → ❌ Falta → ⚠️ Justificada → 🕐 Atraso → ✅

**Lançamento de notas mobile**:

```
┌──────────────────────────────────────┐
│ [←] Prova Bimestral 1 — Português   │
│ Peso: 4.0 · Máx: 10.0               │
├──────────────────────────────────────┤
│ Ana Beatriz Costa                    │
│ [    8.5    ] ← campo numérico grande│
├──────────────────────────────────────┤
│ Carlos Eduardo Silva                 │
│ [    6.0    ]                        │
└──────────────────────────────────────┘
│ Lançados: 18/25    [Salvar notas]    │
└──────────────────────────────────────┘
```

- Teclado numérico (`inputMode="decimal"`)
- Tab automático para o próximo aluno ao confirmar
- Progresso: "18/25 lançados"
- Salvar sticky no footer

### 6.7 Kanban Mobile

**Desktop**: Board horizontal com colunas side-by-side  
**Mobile**: Uma coluna por vez com navegação horizontal

```
Mobile Kanban:
┌──────────────────────────────────┐
│ [←] ← NOVO (12) → [→]           │  ← swipe entre colunas
├──────────────────────────────────┤
│ [+ Novo lead]                    │
│ ┌──────────────────────────────┐ │
│ │ Maria Silva                  │ │
│ │ Matrículas · Alta ↑          │ │
│ │ 3 dias · (81) 999...         │ │
│ └──────────────────────────────┘ │
│ [mover para: Em contato ›]       │  ← quick action
└──────────────────────────────────┘
```

Drag and drop não é viável no mobile. Substituído por:
- Botão "Mover para:" com action sheet listando colunas
- Long press no card → selecionar para mover

### 6.8 WhatsApp Templates Mobile

- Editor com preview em tempo real embaixo (não ao lado)
- Inserção de variáveis: menu action sheet ao tocar `{{`
- Preview do template: bottom sheet com renderização

### 6.9 Configurações Mobile

- Abas de configuração: scroll vertical de seções collapsíveis (accordion)
- Substitui as abas horizontais que não caberiam
- `SettingsCard` mantido — apenas reflow para tela estreita

---

## 7. Área: Portal do Aluno

**Contexto**: Estudante acessa principalmente no smartphone. Espera UX nativa, similar a um app escolar.

### 7.1 Estrutura de Navegação

```
Portal do Aluno — Mobile:
┌──────────────────────────────────────┐
│ 🏫 Batista    João Pedro  [🔔][👤]   │
├──────────────────────────────────────┤
│                                      │
│  [conteúdo da página atual]          │
│                                      │
└──────────────────────────────────────┘
│ 🏠 Home │ 📋 Notas │ 📅 Agenda │ 📚 Mais│
└──────────────────────────────────────┘

Bottom Nav — Portal do Aluno (5 itens):
- 🏠 Home (Dashboard)
- 📝 Notas (GradesPage)
- 📋 Atividades (ActivitiesPage)
- 📢 Feed (Comunicados + Eventos unificados)
- ⋯  Mais (Biblioteca, Grade, Financeiro, Perfil)
```

**Ícone "Mais"** → bottom sheet navegável:
```
┌────────────────────────────────┐
│ MAIS OPÇÕES                    │
│ 📚 Biblioteca Virtual          │
│ 📅 Grade Horária               │
│ 💰 Financeiro                  │
│ 🏛️  Calendário Letivo          │
│ 👤 Perfil                      │
└────────────────────────────────┘
```

### 7.2 Dashboard do Aluno Mobile

```
┌──────────────────────────────────────┐
│ Olá, João Pedro! 👋                  │
│ Quinta, 13 de abril                  │
├──────────────────────────────────────┤
│ HOJE                                 │
│ ┌────────────────────────────────┐   │
│ │ 📝 Prova de Matemática — 13:00│   │
│ └────────────────────────────────┘   │
│ ┌────────────────────────────────┐   │
│ │ 📋 Entregar: Redação — amanhã │   │
│ └────────────────────────────────┘   │
├──────────────────────────────────────┤
│ BOLETIM RÁPIDO          [Ver tudo →] │
│ Mat  ██████████ 8.5 ✅               │
│ Port ████████── 7.2 ✅               │
│ Hist ██████──── 5.8 ⚠️               │
├──────────────────────────────────────┤
│ COMUNICADO RECENTE                   │
│ "Reunião de pais dia 20/04..."       │
│                         [Ver mais →] │
└──────────────────────────────────────┘
```

### 7.3 Notas / Boletim Mobile

```
┌──────────────────────────────────────┐
│ BOLETIM 2026                         │
│ [1º Bim] [2º Bim] [3º Bim] [4º Bim] │
│              ↑ scroll horizontal     │
├──────────────────────────────────────┤
│ Matemática                    8.5 ✅ │
│   P1: 8.0  P2: 9.0           média  │
├──────────────────────────────────────┤
│ Português                     7.2 ✅ │
├──────────────────────────────────────┤
│ História                      5.8 ⚠️ │
│                        [Ver detalhes]│
├──────────────────────────────────────┤
│ FREQUÊNCIA GLOBAL: 89% ✅            │
└──────────────────────────────────────┘
```

### 7.4 Atividades Mobile

```
┌──────────────────────────────────────┐
│ ATIVIDADES          [Pendentes ▼]    │
├──────────────────────────────────────┤
│ 📝 PROVA — Matemática                │
│ Bimestral 2 · vale 4.0 pts           │
│ ⚠️ Amanhã, 13/04 às 13:00            │
├──────────────────────────────────────┤
│ 📋 TRABALHO — Redação                │
│ Análise literária · vale 2.0 pts     │
│ 📅 15/04 · 3 dias restantes          │
├──────────────────────────────────────┤
│ ✅ DEVER — Exercícios pág. 45        │
│ Matemática · Entregue 10/04          │
└──────────────────────────────────────┘
```

Cards tap-expandíveis para ver descrição completa sem sair da lista.

---

## 8. Área: Portal do Responsável

**Contexto**: Pai/mãe acessa esporadicamente mas em momentos críticos (nota baixa, cobrança, ocorrência). UX deve ser clara e sem fricção, com as informações mais importantes visíveis imediatamente.

### 8.1 Estrutura de Navegação

```
Bottom Nav — Portal do Responsável (5 itens):
- 🏠 Home (Dashboard com filho selecionado)
- 📊 Acadêmico (Notas + Frequência unificados)
- 💰 Financeiro
- 💬 Comunicação (Comunicados + Ocorrências + Autorizações)
- ⋯  Mais (Grade, Eventos, Declarações, Rematrícula, Perfil)
```

**Seletor de filho** (quando há mais de um):
```
┌──────────────────────────────────────┐
│ 🏫 Batista         Maria Silva  [˅] │
│                     ↑ tap para trocar│
└──────────────────────────────────────┘

Dropdown ao tocar no nome:
├── João Pedro (7º Ano A)  ← ativo
├── Ana Beatriz (3º Ano B)
└── + Adicionar filho
```

### 8.2 Dashboard do Responsável Mobile

Prioriza alertas e pendências financeiras:

```
┌──────────────────────────────────────┐
│ Boa tarde, Maria! 👋                 │
├──────────────────────────────────────┤
│ [João Pedro Silva — 7º Ano A]  [›]   │
├──────────────────────────────────────┤
│ ⚠️ ATENÇÃO                           │
│ Mensalidade de Abril em atraso       │
│ R$ 862,50 · 5 dias                  │
│              [Ver e pagar →]         │
├──────────────────────────────────────┤
│ RESUMO ACADÊMICO                     │
│ Média geral: 7.4 ✅                  │
│ Frequência: 87% ✅                   │
│ Atividades pendentes: 2              │
├──────────────────────────────────────┤
│ ÚLTIMAS NOVIDADES                    │
│ 📢 Reunião de pais — 20/04          │
│ 📝 Nova ocorrência registrada       │
└──────────────────────────────────────┘
```

Alertas financeiros têm destaque visual (card laranja/vermelho) e botão de ação direto.

### 8.3 Ocorrências Mobile

```
┌──────────────────────────────────────┐
│ [←] Ocorrências · João Pedro        │
├──────────────────────────────────────┤
│ [Abertas] [Resolvidas] [Todas]       │
├──────────────────────────────────────┤
│ ⚠️ COMPORTAMENTAL · Alta             │
│ 11/04/2026 · Prof. Carlos Lima      │
│ "João utilizou o celular durante..." │
│ [tap para expandir]                  │
│ STATUS: Aguardando sua resposta      │
│              [Responder]             │
├──────────────────────────────────────┤
│ ⭐ ELOGIO · Normal                   │
│ 08/04/2026 · Coord. Ana Paula       │
│ "Participação exemplar na..."        │
└──────────────────────────────────────┘
```

**Responder ocorrência** → AdaptiveModal (snap 0.65) com campo de texto e botão "Enviar resposta".

### 8.4 Financeiro do Responsável Mobile

```
┌──────────────────────────────────────┐
│ FINANCEIRO · 2026                    │
│ Plano: Fundamental II — R$ 850/mês  │
├──────────────────────────────────────┤
│ Jan  ✅ R$ 850,00 · Pago 05/01       │
│ Fev  ✅ R$ 850,00 · Pago 04/02       │
│ Mar  ✅ R$ 850,00 · Pago 08/03       │
│ Abr  🔴 R$ 862,50 · 5 dias atraso   │
│      [Copiar PIX] [Ver boleto]       │
│ Mai  ⏳ R$ 850,00 · Vence 10/05      │
│ Jun  ⏳ R$ 850,00 · Vence 10/06      │
└──────────────────────────────────────┘
```

Parcelas em atraso: card destacado com ação de pagamento inline. PIX código copiável com um tap.

---

## 9. Área: Atendimento Presencial

Esta área já tem vocação mobile — o visitante usa o próprio celular para fazer check-in via QR Code. Mas precisa de ajustes específicos.

### 9.1 Tela de Check-in (`/atendimento`) — Otimizações

Já é mobile-first. Refinamentos:

- **Input de celular**: teclado numérico automático (`inputMode="tel"`)
- **Confirmação visual**: animação de sucesso com haptic feedback (`navigator.vibrate(200)`)
- **Tela de espera**: status da senha em tempo real com animação de "chamado"
- **Notificação quando chamado**: Web Push Notification (PWA) se disponível; visual+som se não

**Web Push para fila**:
```typescript
// Ao emitir senha, registrar subscription
const subscription = await swRegistration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: VAPID_PUBLIC_KEY
})
// Salvar em attendance_tickets.push_subscription

// Ao chamar a senha (painel do atendente):
// Edge Function: send-push-notification
// → Envia push para o dispositivo do visitante
// → "Sua senha 🎟️ A-007 está sendo chamada!"
```

### 9.2 Painel de Exibição (`/painel-atendimento`)

Este painel é **exclusivo para TV/monitor** (não adaptar para mobile). Adicionar:
- Lock rotation: forçar landscape no manifest
- Prevent sleep: `navigator.wakeLock.request('screen')`
- Prevent screen off durante o expediente

---

## 10. Módulos com Padrões Específicos

### 10.1 Tabelas → Mobile Cards

**Regra universal**: Nenhuma tabela HTML aparece em telas < 768px. Toda tabela tem um `mobileCard` alternativo definido via `AdaptiveTable`.

**Mapeamento por módulo**:

| Módulo | Coluna Primary (card) | Coluna Secondary | Badge |
|--------|----------------------|-----------------|-------|
| Matrículas | Nome do aluno | Responsável + telefone | Status |
| Contatos | Nome + telefone | Motivo de contato | Status |
| Agendamentos | Nome + data/hora | Motivo da visita | Status |
| Alunos | Nome + matrícula | Turma | Ativo/Inativo |
| Usuários | Nome + role | E-mail | Ativo/Inativo |
| Leads (lista) | Nome + dias no estágio | Origem | Prioridade |
| Parcelas | Mês referência + valor | Vencimento | Status |
| Notas (admin) | Nome do aluno | Turma | Média |

### 10.2 Formulários Mobile

**Regras universais para formulários**:

```
✅ Faça:
- Labels sempre acima do campo (nunca placeholder como label)
- Um campo por linha (nunca duas colunas no mobile)
- input type semântico (tel, email, number, date, search)
- inputMode correto (numeric, decimal, tel, email)
- autocomplete attr em campos de perfil
- Botão de submit: largura total, altura mínima 52px (toque confortável)
- Feedback inline de erro (abaixo do campo, não como alert global)
- Scroll automático para o campo com erro ao submeter

❌ Não faça:
- Dois campos lado a lado (nome + sobrenome, por exemplo)
- Botão de submit no header da página
- Dropdown com muitas opções (> 6) — usar bottom sheet com busca
- Date picker nativo CSS — usar calendário próprio
```

**Date picker mobile**:
```
Substituir <input type="date"> (inconsistente entre dispositivos) por:
→ Campo de texto com trigger visual
→ Tap abre bottom sheet com calendário próprio
→ Navegação mês a mês com swipe lateral
→ Grade de dias tap-selecionável
```

### 10.3 Filtros Mobile

**Desktop**: Filtros inline no topo da lista (row com selects + busca)  
**Mobile**: FAB de filtro (🎛️) + bottom sheet com todos os filtros + badge com count de filtros ativos

```
Mobile — Barra de busca compacta:
┌──────────────────────────────────────┐
│ [🔍 Buscar...]               [🎛️ 2] │
└──────────────────────────────────────┘
                                  ↑ badge "2" = 2 filtros ativos

Bottom sheet de filtros (ao tap 🎛️):
┌────────────────────────────────┐
│ ▬          FILTROS             │
│                [Limpar tudo]   │
├────────────────────────────────┤
│ STATUS                         │
│ ○ Todos  ● Em análise  ○ ...  │
├────────────────────────────────┤
│ PERÍODO                        │
│ [13/03/2026] até [13/04/2026] │
├────────────────────────────────┤
│ SEGMENTO                       │
│ [✓] Fund. I  [✓] Fund. II ...  │
└────────────────────────────────┘
│         [Aplicar filtros (12)] │
└────────────────────────────────┘
```

### 10.4 Upload de Arquivos Mobile

**Atualização do campo de upload para suporte mobile**:

```tsx
// src/components/ui/FileUpload.tsx — versão mobile

// Mobile: toca no campo → action sheet
const mobileUploadOptions = [
  { label: 'Tirar foto',         icon: Camera,  action: () => openCamera() },
  { label: 'Galeria de fotos',   icon: Image,   action: () => openGallery() },
  { label: 'Arquivos (PDF)',     icon: File,    action: () => openFiles() },
]

// Usar accept="image/*,application/pdf" + capture="environment"
// No iOS: <input type="file" accept="image/*" capture="environment">
//         abre câmera traseira diretamente
```

### 10.5 Notificações (bell icon)

**Desktop**: Painel dropdown no header  
**Mobile**: Full screen com back button

```
Mobile — Notificações (full screen):
┌──────────────────────────────────────┐
│ [←]  Notificações        [Todas lidas]│
├──────────────────────────────────────┤
│ HOJE                                 │
│ ┌──────────────────────────────────┐ │
│ │ 🔴  Nova pré-matrícula recebida  │ │
│ │     João Pedro · há 5 min        │ │
│ └──────────────────────────────────┘ │
│ ONTEM                                │
│ ...                                  │
└──────────────────────────────────────┘
```

Badge no ícone da bottom nav (se admin) ou no header.

### 10.6 Login Pages (todas as áreas)

```
Mobile — Login:
┌──────────────────────────────────────┐
│                                      │
│     [Logo — 120px]                   │
│     Colégio Batista                  │
│     Portal do Aluno                  │
│                                      │
├──────────────────────────────────────┤
│ Matrícula                            │
│ [___________________________]        │
│                                      │
│ Senha                                │
│ [_________________________🔓]        │
│                                      │
│ [      Entrar      ]                 │
│                                      │
│ Primeiro acesso? Clique aqui         │
└──────────────────────────────────────┘
```

- Autofill de credenciais: `autocomplete="current-password"` para portais
- Biometria: `PasswordCredential` / `PublicKeyCredential` (passkey) onde disponível
- Teclado numérico no campo de matrícula

---

## 11. Interações Touch e Gestos

### 11.1 Targets de Toque

Todo elemento interativo precisa ter área de toque mínima de **44×44px** (Apple HIG / WCAG 2.5.5):

```css
/* Aplicado em todos os botões, links e inputs */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  /* Para ícones pequenos: usar padding para expandir área */
  padding: 10px;
  margin: -10px;  /* compensa o padding visual */
}
```

### 11.2 Feedback Háptico

```typescript
// src/lib/haptics.ts

export const haptics = {
  // Confirmação leve (tap em checkbox, seleção)
  light: () => navigator.vibrate?.(10),

  // Ação concluída (salvar, aprovar)
  success: () => navigator.vibrate?.([10, 50, 10]),

  // Erro (validação falhou)
  error: () => navigator.vibrate?.([20, 20, 20, 20, 20]),

  // Aviso / atenção
  warning: () => navigator.vibrate?.(30),

  // Ação destrutiva (deletar, cancelar)
  heavy: () => navigator.vibrate?(50),
}

// Uso:
// haptics.success() ao salvar frequência
// haptics.error() ao tentar avançar com erro no form
// haptics.light() ao marcar presença/falta
```

### 11.3 Pull to Refresh

Implementado nas seguintes listagens:
- Todas as listas do admin (`EnrollmentsPage`, `AppointmentsPage`, `ContactsPage`)
- Dashboard do admin
- Portal do aluno: todas as páginas
- Portal do responsável: todas as páginas

### 11.4 Swipe para Voltar

React Router v6 não suporta swipe back nativo. Compensação via gesture:

```typescript
// src/hooks/useSwipeBack.ts

export function useSwipeBack() {
  const navigate = useNavigate()

  useEffect(() => {
    let startX = 0

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX
      const deltaX = endX - startX

      // Swipe da borda esquerda (< 30px) → direita (> 80px)
      if (startX < 30 && deltaX > 80) {
        navigate(-1)
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [navigate])
}
```

Ativado em todas as páginas de detalhe (drawer full-screen no mobile).

### 11.5 Prevenção de Zoom Indesejado em Inputs

iOS faz zoom automático em inputs com font-size < 16px:

```css
/* Prevenir zoom em todos os inputs */
input, select, textarea {
  font-size: 16px; /* NUNCA menor que 16px em mobile */
}

@media (min-width: 768px) {
  input, select, textarea {
    font-size: 14px; /* desktop pode ter menor */
  }
}
```

---

## 12. Tipografia e Espaçamento Adaptativo

### 12.1 Escala tipográfica responsiva

```css
/* src/styles/typography.css */
/* Fluid typography: escala linear entre mobile e desktop */

:root {
  /* Títulos */
  --text-4xl: clamp(1.75rem, 5vw, 2.25rem);   /* 28px → 36px */
  --text-3xl: clamp(1.5rem,  4vw, 1.875rem);  /* 24px → 30px */
  --text-2xl: clamp(1.25rem, 3vw, 1.5rem);    /* 20px → 24px */
  --text-xl:  clamp(1.125rem,2vw, 1.25rem);   /* 18px → 20px */

  /* Corpo */
  --text-lg:  1.125rem;   /* 18px — constante */
  --text-base: 1rem;      /* 16px — constante (mínimo para inputs) */
  --text-sm:  0.875rem;   /* 14px */
  --text-xs:  0.75rem;    /* 12px — usar com moderação no mobile */

  /* Espaçamento de toque */
  --touch-sm: 36px;   /* botões secundários */
  --touch-md: 44px;   /* botões primários, links de lista */
  --touch-lg: 52px;   /* campos de formulário */
  --touch-xl: 60px;   /* botões FAB, CTAs principais */
}
```

### 12.2 Espaçamento de conteúdo

```css
/* Padding horizontal das páginas */
.page-content {
  padding-left:  clamp(1rem, 4vw, 2rem);
  padding-right: clamp(1rem, 4vw, 2rem);
}

/* Gap entre cards em listas */
.card-list {
  gap: clamp(0.5rem, 2vw, 1rem);
}

/* Padding interno dos cards */
.card {
  padding: clamp(0.75rem, 3vw, 1.25rem);
}
```

---

## 13. Performance Mobile

### 13.1 Core Web Vitals — metas

| Métrica | Meta | Crítico |
|---------|------|---------|
| LCP (Largest Contentful Paint) | < 2.5s | < 4s |
| FID (First Input Delay) | < 100ms | < 300ms |
| CLS (Cumulative Layout Shift) | < 0.1 | < 0.25 |
| TTI (Time to Interactive) | < 3.5s | < 7.3s |

### 13.2 Técnicas obrigatórias

**Code splitting por área** (já implementado):
```typescript
// Admin, Portal e Site são bundles separados
// Cada módulo do admin é lazy-loaded
const EnrollmentsPage = lazy(() => import('./pages/EnrollmentsPage'))
```

**Imagens**:
```html
<!-- Usar srcset para todas as imagens do hero -->
<img
  src="hero-800.webp"
  srcset="hero-400.webp 400w, hero-800.webp 800w, hero-1200.webp 1200w"
  sizes="(max-width: 768px) 100vw, 800px"
  loading="lazy"
  decoding="async"
/>
```

**Fontes** (já via Google Fonts URL dinâmica):
```html
<!-- Preload da fonte principal -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- font-display: swap nas @font-face -->
```

**Lista virtualizada** para listas longas (> 100 itens):
```typescript
// Usar react-virtual para listas de alunos, parcelas, etc.
import { useVirtualizer } from '@tanstack/react-virtual'

// Aplicar em: StudentsPage, financial_installments, whatsapp_message_log
```

**Skeleton loading** em todas as listas:
```tsx
// Substituir spinners por skeleton cards que espelham a estrutura do card real
// Evita layout shift ao carregar

function SkeletonCard() {
  return (
    <div className="animate-pulse bg-gray-100 rounded-xl p-4 space-y-2">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  )
}
```

### 13.3 Bundle size budget

| Bundle | Limite gzip |
|--------|------------|
| Site público | ≤ 80 KB |
| Admin | ≤ 200 KB (inicial) + chunks |
| Portal do Aluno | ≤ 100 KB |
| Portal do Responsável | ≤ 100 KB |
| Atendimento | ≤ 60 KB |

---

## 14. Implementação — Sequência de Desenvolvimento

### Fase 13.1 — Fundação PWA (Sprint 1 — 1 semana)

| Tarefa | Complexidade | Impacto |
|--------|:----------:|:-------:|
| Instalar `vite-plugin-pwa` + configurar Workbox | Baixa | 🔴 Crítico |
| Criar manifests (site, portal aluno, responsável) | Baixa | 🔴 Crítico |
| Configurar safe areas CSS | Baixa | 🔴 Crítico |
| Implementar `useScreen()` hook | Baixa | 🔴 Crítico |
| Extender breakpoints no Tailwind | Baixa | 🔴 Crítico |
| Meta tags iOS + viewport | Baixa | 🔴 Crítico |
| OfflineBanner component | Baixa | 🟡 Alto |
| InstallPrompt component | Média | 🟢 Médio |

### Fase 13.2 — Primitivas Adaptativas (Sprint 2 — 1 semana)

| Tarefa | Complexidade |
|--------|:----------:|
| `AdaptiveModal` (modal → bottom sheet) | Alta |
| `AdaptiveDrawer` (drawer → full screen) | Alta |
| `AdaptiveTable` (tabela → cards) | Alta |
| `AdaptiveTabs` (tabs fixas → scroll) | Média |
| `FAB` component | Média |
| `SwipeActions` component | Alta |
| `BottomNav` component | Média |
| `ActionSheet` component | Média |
| `PullToRefresh` component | Média |

### Fase 13.3 — Site Institucional Mobile (Sprint 3 — 1 semana)

| Tarefa | Complexidade |
|--------|:----------:|
| Navbar mobile + drawer lateral | Média |
| Hero slideshow mobile (swipe + 100svh) | Média |
| Formulário de matrícula (wizard mobile) | Alta |
| Formulário de agendamento (calendário mobile) | Alta |
| Páginas de segmento (accordion + carousel) | Média |
| Footer mobile otimizado | Baixa |

### Fase 13.4 — Admin Panel Mobile (Sprint 4 — 2 semanas)

| Tarefa | Complexidade |
|--------|:----------:|
| Layout responsivo (sidebar → bottom nav) | Alta |
| Mapeamento de rotas → bottom nav por role | Alta |
| Dashboard mobile (reflow de cards) | Média |
| `AdaptiveTable` em todas as listas (6 módulos) | Alta |
| Detalhe de registro → AdaptiveDrawer full screen | Alta |
| Filtros → FAB + bottom sheet (6 módulos) | Alta |
| **Frequência mobile** (tap cycling, sticky save) | Alta |
| **Notas mobile** (campo numérico + tab sequencial) | Alta |
| Kanban mobile (coluna por vez + action sheet move) | Alta |
| Configurações → accordion (substitui tabs) | Média |

### Fase 13.5 — Portais Mobile (Sprint 5 — 1.5 semanas)

| Tarefa | Complexidade |
|--------|:----------:|
| Portal Aluno: bottom nav + layout | Média |
| Portal Aluno: dashboard cards | Média |
| Portal Aluno: notas com bimestres (scroll tabs) | Média |
| Portal Aluno: atividades (cards expansíveis) | Média |
| Portal Responsável: bottom nav + layout | Média |
| Portal Responsável: seletor de filho | Média |
| Portal Responsável: dashboard com alertas | Média |
| Portal Responsável: ocorrências + resposta | Alta |
| Portal Responsável: financeiro + PIX | Alta |
| Login pages mobile (todos os portais) | Média |

### Fase 13.6 — Polimento e PWA Completo (Sprint 6 — 1 semana)

| Tarefa | Complexidade |
|--------|:----------:|
| Haptic feedback em ações-chave | Baixa |
| Swipe back (gesture) | Média |
| Web Push para atendimento | Alta |
| `navigator.wakeLock` no painel TV | Baixa |
| Prevenção zoom inputs (16px) | Baixa |
| Skeleton loading em todas as listas | Média |
| Lista virtualizada (> 100 itens) | Alta |
| Testes de performance (Lighthouse) | Baixa |
| Testes em dispositivos reais (iOS + Android) | Média |
| `InstallPrompt` e analytics de instalação | Média |

---

## 15. Checklist de Qualidade Mobile

A ser verificado antes do deploy de cada área:

### PWA
- [ ] Manifest.json válido (testado no Chrome DevTools → Manifest)
- [ ] Service Worker registrado e ativo
- [ ] App instalável no Android (Chrome) e iOS (Safari "Adicionar à tela")
- [ ] Ícone maskable correto (sem elementos cortados)
- [ ] Theme-color consistente com branding
- [ ] Splash screen sem FOUC (Flash of Unstyled Content)

### Layout
- [ ] Nenhum overflow horizontal em < 360px
- [ ] Safe areas respeitadas (testar em iPhone com notch)
- [ ] Bottom nav não sobrepõe conteúdo (padding-bottom correto)
- [ ] FAB não sobrepõe conteúdo crítico
- [ ] Nenhuma tabela HTML em telas < 768px

### Formulários
- [ ] Todos os inputs têm font-size ≥ 16px (sem zoom iOS)
- [ ] Labels acima dos campos
- [ ] Teclados semânticos (tel, email, numeric)
- [ ] Botões de submit ≥ 44px de altura
- [ ] Scroll para campo com erro ao submeter
- [ ] Upload funciona com câmera nativa (iOS + Android)

### Interações
- [ ] Todos os elementos interativos ≥ 44×44px
- [ ] Pull to refresh funcionando nas listas
- [ ] Swipe actions funcionando nos cards (onde implementado)
- [ ] Bottom sheets fecham com swipe down e tap no backdrop
- [ ] Modais têm scroll interno quando conteúdo excede a tela

### Performance
- [ ] LCP < 2.5s em conexão 4G simulada
- [ ] Sem layout shift visível ao carregar (CLS < 0.1)
- [ ] Skeleton loading em todas as listas
- [ ] Imagens com srcset e lazy loading
- [ ] Bundle inicial < limite definido por área

### Offline
- [ ] Banner de "sem conexão" aparece quando offline
- [ ] Dados do cache exibidos corretamente quando offline
- [ ] Ações com mutação mostram feedback de erro quando offline

### Portais (extra)
- [ ] Prompt de instalação aparece após 2 visitas
- [ ] Notificações push funcionando (Android)
- [ ] Autofill de senha funcionando nos formulários de login
- [ ] Seletor de filho funciona no responsável (multi-filhos)

---

*Este PRD cobre a adaptação completa do sistema para mobile-first e PWA. Todas as funcionalidades existentes e futuras (PRD ERP Complementar) devem ser desenvolvidas seguindo as primitivas e padrões definidos aqui desde o início, evitando refatoração posterior.*
