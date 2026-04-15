

## Diagnóstico confirmado

- O `.env` está no `.gitignore` (linha 6-7: `.env` e `.env.*`)
- Lovable Secrets são **runtime** (Edge Functions), não são injetados como `VITE_*` no build do Vite
- Resultado: `import.meta.env.VITE_SUPABASE_URL` é `undefined` em produção → Supabase client falha silenciosamente → tela em branco

## Plano recomendado: Opção 2 — `.env.production` commitado por cliente

Esta é a opção mais simples e compatível com o fluxo multi-tenant existente.

### Mudanças

1. **Remover `.env.production` do `.gitignore`**
   - Alterar linha 7 de `.env.*` para `!.env.production` (manter `.env.local` ignorado)

2. **Criar `.env.production`** com os valores do cliente atual:
   ```
   VITE_SUPABASE_PROJECT_ID=dinbwugbwnkrzljuocbs
   VITE_SUPABASE_URL=https://dinbwugbwnkrzljuocbs.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbmJ3dWdid25rcnpsanVvY2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTc4MTIsImV4cCI6MjA5MTA3MzgxMn0.OJ7aJKdDQbL3Ud5GXMYDs-tQn4rotme_qibkvIaqL8M
   ```

3. **Atualizar `scripts/new-client.sh`** para gerar o `.env.production` automaticamente durante o onboarding (já tem os valores como parâmetros)

### Por que não Opção 1 (Secrets do Lovable)

Lovable Secrets são injetados apenas em Edge Functions (runtime), não no build do Vite. Variáveis `VITE_*` precisam existir no filesystem durante `vite build`.

### Por que não Opção 3 (window.__CONFIG__)

Funciona, mas exige refatorar todos os pontos que usam `import.meta.env.VITE_*` (client.ts, config/client.ts, etc.) e adicionar complexidade desnecessária.

### Nota de segurança

A `SUPABASE_PUBLISHABLE_KEY` (anon key) é **pública por design** — é seguro commitá-la. A service-role key nunca deve ser commitada.

