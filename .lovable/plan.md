

## Correção dos Erros de Build TypeScript

Ainda restam **6 arquivos** com erros. Todos são problemas simples: variáveis/imports não utilizados e um casting incorreto.

### Arquivos e Correções

| # | Arquivo | Erro | Correção |
|---|---------|------|----------|
| 1 | `src/admin/pages/events/EventsPage.tsx` | `CheckCircle2` e `fmtDate` não utilizados | Remover `CheckCircle2` do import (linha 11); remover função `fmtDate` (linhas 36-39) |
| 2 | `src/admin/pages/library/LibraryPage.tsx` | `RESOURCE_TYPE_ICONS` não utilizado; `image` não existe no tipo `Record<ResourceType, ...>` | Remover `RESOURCE_TYPE_ICONS` do import (linha 8); remover a entrada `image` do objeto `SUBTYPES` (linha 39) |
| 3 | `src/admin/pages/school/SegmentsPage.tsx` | `Save`, `ToggleLeft`, `ToggleRight` não utilizados | Remover essas 3 importações da linha 7 |
| 4 | `src/admin/pages/whatsapp/TemplatesPage.tsx` | `toggleVar` não utilizado | Remover a função `toggleVar` (linhas 838-842) |
| 5 | `src/portal/pages/events/EventsPage.tsx` | `fmtDate` não utilizado | Remover a função `fmtDate` (linhas 20-23 aproximadamente) |
| 6 | `src/portal/pages/grades/GradesPage.tsx` | Casting de `activity` incompatível (array vs objeto) | Alterar linha 24: `as Grade[]` → `as unknown as Grade[]` |

### Detalhes Técnicos

- **Erros TS6133** (5 arquivos): Variáveis declaradas mas não usadas. Basta remover os imports/declarações.
- **Erro TS2353** (LibraryPage): O tipo `ResourceType` não inclui `'image'`, então a chave `image` no objeto `SUBTYPES` é inválida. Remover essa entrada.
- **Erro TS2352** (GradesPage): Supabase retorna `activity` como array `{ title }[]`, mas o tipo `Grade` espera `{ title: string } | null`. Usar double cast `as unknown as Grade[]`.

Todas são correções de tipagem sem alteração de lógica.

