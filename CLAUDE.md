# CLAUDE.md

Instruções permanentes para qualquer agente Claude Code trabalhando neste repositório.
Este arquivo vive no `base` (upstream `school-platform`) e é propagado para todos os clientes.

## Contexto do projeto

Plataforma escolar React + Vite + Supabase estruturada como produto multi-cliente.

- **`systemieven/school-platform`** — repo base genérico (upstream). Código 100% genérico, sem dados de cliente.
- **`systemieven/batista-site`** — primeiro cliente (Colégio Batista em Caruaru). Conectado ao Lovable.
- Novos clientes são forks do `school-platform` com `.env` próprio commitado em `main`.

Detalhes completos em `docs/PRD_V3.md` seção 2.3.

## Regras de push — LEIA ANTES DE QUALQUER COMMIT

**SEMPRE use `./scripts/push-all.sh`. NUNCA rode `git push` direto.**

O script detecta o branch atual e faz a sincronização merge-based correta:

- **Em `base`** (trabalho genérico — a maior parte dos commits):
  1. `git push upstream base:main` (fast-forward, mantém school-platform linear)
  2. `git checkout main && git merge base --no-ff`
  3. `git push origin main` (fast-forward, Lovable consome daqui)
  4. `git checkout base`

- **Em `main`** (raro — só pra mexer no `.env` do cliente):
  1. `git push origin main`
  2. (upstream nunca recebe)

**Zero force-push. Zero rebase.** Se algo pedir `--force` ou `--force-with-lease` em operação normal, pare e investigue — algo está errado.

Detalhes e racional em `memory/feedback_git_push.md` (memória local do agente).

## Estrutura de branches

| Branch | Rastreia | Conteúdo | Contém `.env`? |
|--------|----------|----------|----------------|
| `base` | `upstream/main` (school-platform) | Código genérico | ❌ Nunca |
| `main` | `origin/main` (repo do cliente) | `base` + commit do `.env` + merges | ✅ Sim (só no cliente) |

Trabalho genérico (features, fixes, refactors) → faça em `base`.
Trabalho específico do cliente (rotacionar chave Supabase, ajustar identidade fallback) → faça em `main`.

## Regra do `.env`

- `.env` (sem sufixo) é **tracked apenas em `main` dos repos de cliente**. Não mexa no `.gitignore` pra "consertar" isso.
- `base` (school-platform) **nunca** tem `.env` — só `.env.example`.
- **Por quê:** a integração Lovable Cloud injeta `VITE_SUPABASE_*` apenas no preview (dev server). O `vite build` do publish só vê o filesystem do checkout, então `.env` precisa estar commitado ou o site publicado quebra com "Variáveis de ambiente ausentes".
- Dev local: use `.env.local` (gitignored via pattern `*.local`). Vite carrega em todos os modos.

## Versões de dependência

**Pinar sem caret.** Exemplo: `"vite": "5.1.6"`, não `"^5.1.6"`.

Motivo: Lovable usa `npm install` (não `npm ci`), então caret vira drift entre lockfile e instalação e quebra o preview com erros de chunk do Vite tipo `Cannot find module '.../chunks/dep-xxx.js'`. Aprendizado da hard way em abril/2026.

Vale especialmente para `vite`, `@vitejs/plugin-react`, `typescript`, `react`, `react-dom` — qualquer coisa que afete build.

## Dados de cliente: nunca hardcode

Todo conteúdo específico de cliente (nome da escola, CNPJ, endereço, WhatsApp, cores, fontes, email de contato, slogan, etc.) vem de:

1. `src/config/client.ts` — defaults genéricos lidos de env vars `VITE_SCHOOL_*`
2. `useBranding()` / `useSettings()` — hooks que leem `system_settings` do DB (fonte de verdade, editável via `/admin/configuracoes`)

Se você precisar de um fallback, use valor **genérico** (ex.: "Colégio", "contato@escola.com.br"), nunca o nome real de um cliente.

Arquivos historicamente problemáticos (revisar antes de editar):
- `src/components/layout/Footer.tsx`, `Navbar.tsx`
- `src/pages/Contato.tsx`, `Home.tsx`, `AgendarVisita.tsx`
- `src/pages/PoliticaPrivacidade.tsx`, `TermosUso.tsx`
- `src/hooks/useSEO.ts`
- `src/admin/pages/login/LoginPage.tsx`
- `src/admin/pages/settings/*`

## Propagação automática

- `.github/workflows/propagate.yml` no `school-platform` — a cada push em main, abre PR automaticamente nos clientes (matrix strategy). Tem skip-early via `merge-base --is-ancestor`, não cria sync branches vazias.
- `.github/workflows/sync-upstream.yml` nos clientes — dispatch manual, redundante com propagate.
- Guard `if: github.repository == 'systemieven/school-platform'` impede execução nos clientes.

## Scripts úteis

- `./scripts/push-all.sh` — push unificado (ver acima)
- `./scripts/new-client.sh <nome> <supabase-ref>` — onboarding de novo cliente
- `./scripts/push-migrations.sh` — aplica migrations em lote
- `./scripts/deploy-functions.sh` — deploy de Edge Functions em lote

## Referências

- `docs/PRD_V3.md` — PRD atual (seção 2.3 tem a arquitetura multi-cliente completa)
- `.env.example` — template versionado com comentários sobre Lovable Cloud
- `memory/project_multi_client.md` — memória local do agente com o setup detalhado
- `memory/feedback_git_push.md` — racional do workflow merge-based
