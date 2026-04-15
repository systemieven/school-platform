#!/usr/bin/env bash
# push-all.sh — publica o branch atual em upstream (school-platform) e
# origin (batista-site) apontando ambos para o mesmo SHA.
#
# Invariante pós-realinhamento: `base` e `main` devem estar sempre no
# mesmo commit. Não existe mais divergência de `.env` entre eles —
# credenciais Supabase vêm da integração Lovable Cloud e identidade da
# escola fica no `system_settings` do banco.
#
# Uso:
#   git checkout base         # (ou main — tanto faz, são idênticos)
#   # editar, testar, commitar
#   ./scripts/push-all.sh
#
# O script:
#   1. Push do branch atual como `main` nos dois remotos (fast-forward).
#   2. Alinha o outro branch local (main ou base) pro mesmo SHA.

set -e

CURRENT=$(git rev-parse --abbrev-ref HEAD)

if [ "$CURRENT" != "base" ] && [ "$CURRENT" != "main" ]; then
  echo "✗ Erro: rode este script em 'base' ou 'main'. Branch atual: $CURRENT"
  exit 1
fi

OTHER="main"
[ "$CURRENT" = "main" ] && OTHER="base"

echo "→ Push upstream main (school-platform)..."
git push upstream "$CURRENT":main

echo "→ Push origin main (batista-site)..."
git push origin "$CURRENT":main

# Alinha o branch local que não está checked out
if git show-ref --verify --quiet "refs/heads/$OTHER"; then
  echo "→ Alinhando branch local '$OTHER' com '$CURRENT'..."
  git branch -f "$OTHER" "$CURRENT"
fi

echo "✓ upstream, origin e branches locais apontam para o mesmo commit."
