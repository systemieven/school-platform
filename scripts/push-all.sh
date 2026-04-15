#!/usr/bin/env bash
# push-all.sh — envia commits genéricos para upstream e tudo (incluindo
# .env.production do cliente) para origin, mantendo o repo base limpo.
#
# Invariante: o branch `base` rastreia upstream/main (school-platform,
# código genérico). O branch `main` rastreia origin/main (batista-site,
# base + .env.production no topo).
#
# Uso:
#   1. Para commits GENÉRICOS (features, fixes, docs):
#        git checkout base
#        # fazer mudanças e commitar
#        ./scripts/push-all.sh
#
#   2. Para commits CLIENT-ONLY (.env.production, customizações Batista):
#        git checkout main
#        # fazer mudanças e commitar
#        git push origin main
#
# O script detecta em qual branch está e age de acordo.

set -e

CURRENT=$(git rev-parse --abbrev-ref HEAD)

case "$CURRENT" in
  base)
    echo "→ Em branch 'base' — commits genéricos"
    echo "→ Push upstream main..."
    git push upstream base:main
    echo "→ Rebasing main sobre base..."
    git checkout main
    git rebase base
    echo "→ Push origin main (force-with-lease)..."
    git push origin main --force-with-lease
    echo "✓ Feito. upstream e origin sincronizados."
    ;;
  main)
    echo "→ Em branch 'main' — commits client-specific"
    echo "→ Push origin main..."
    git push origin main
    echo "✓ Feito. (upstream NÃO recebe esse commit — ok para client-only)"
    ;;
  *)
    echo "✗ Erro: este script só funciona em 'base' ou 'main'."
    echo "  Branch atual: $CURRENT"
    exit 1
    ;;
esac
