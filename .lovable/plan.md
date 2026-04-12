

## Erros que Impedem a Publicação

Há **2 erros de TypeScript**:

### 1. `src/pages/PainelAtendimento.tsx` — tipos incompatíveis entre `AuthResult`
O `PainelAtendimento.tsx` define `AuthResult.config` com `show_history` e `ticket_effect`, mas o `PanelAuthScreen.tsx` define seu próprio `PanelConfig` sem essas propriedades. Como ambos usam o mesmo `setAuth`, os tipos colidem.

**Correção**: Adicionar `show_history: boolean` e `ticket_effect: string` ao `PanelConfig` no `PanelAuthScreen.tsx` (linhas 4-11), alinhando com a definição em `PainelAtendimento.tsx`.

### 2. `src/pages/painel-atendimento/PanelDisplay.tsx` — `sectors` não utilizado
O parâmetro `sectors` é declarado na Props mas nunca usado (linha 39).

**Correção**: Remover `sectors` da desestruturação e da interface `Props`.

### Implementação
Dois edits pontuais em dois arquivos. Nenhuma lógica é afetada.

