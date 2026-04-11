

## Erros que Impedem a Publicação

Foram encontrados **4 erros de TypeScript** no build:

### 1. `src/admin/pages/settings/AppearanceSettingsPanel.tsx`
- **Linha 1**: `useCallback` importado mas nunca usado — remover do import
- **Linha 12**: `Toggle` importado mas nunca usado — remover a linha inteira

### 2. `src/admin/pages/settings/AttendanceSettingsPanel.tsx`
- **Linha 27**: `CalendarCheck` importado mas nunca usado — remover do import

### 3. `src/pages/AgendarVisita.tsx`
- **Linha 646**: `min_advance_hours` não existe no tipo do fallback. O objeto fallback (linhas 383-392) não inclui a propriedade `min_advance_hours`, mas o código a acessa na linha 646
- **Correção**: adicionar `min_advance_hours: 0` ao objeto fallback (após `lead_integrated`)

### Implementação
Quatro edits pontuais em três arquivos. Nenhuma lógica é afetada — apenas remoção de imports não utilizados e adição de uma propriedade default ao fallback.

