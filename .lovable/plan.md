

## Erros que Impedem a Publicação

Há **3 erros de TypeScript** (TS6133) — todos imports não utilizados:

### 1. `src/admin/pages/settings/AttendanceSettingsPanel.tsx` (linha 62)
- `Palette` importado de `lucide-react` mas nunca usado
- **Correção**: remover `Palette,` da linha 62

### 2. `src/admin/pages/settings/SettingsPage.tsx` (linha 5)
- `TITLE_CLS` e `CollapsibleSection` importados de `SettingsCard` mas nunca usados
- **Correção**: alterar o import para `import { SettingsCard } from '../../components/SettingsCard';`

### Nota
O erro sobre `npm:openai@^4.52.5` é um problema de resolução de tipos do Deno nas Edge Functions do Supabase — não bloqueia o build do frontend.

### Implementação
Duas linhas a alterar. Nenhuma lógica é afetada.

