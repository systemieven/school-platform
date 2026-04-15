#!/usr/bin/env bash
# push-all.sh — sincroniza os dois remotos (upstream/school-platform e
# origin/cliente) sem rebase e sem force-push, usando merge.
#
# Arquitetura:
#   • `base` = código genérico, rastreia upstream/main (school-platform).
#     Nunca contém `.env`.
#   • `main` = descendente de base com o commit do `.env` do cliente
#     acima. Rastreia origin/main (o que o Lovable consome).
#
# Por que merge e não rebase: o rebase reescreve SHAs do topo de `main`
# toda vez que `base` avança, exigindo force-push. O Lovable cacheia o
# SHA publicado e às vezes falha com "commit not found" após force-push.
# Com merge, a linha de commits de `main` só avança (fast-forward puro),
# preservando SHAs e eliminando force-push de vez.
#
# Diagrama (após algumas syncs):
#
#     base:    A---B---C---D---F                   (upstream/main)
#                        \\   \\
#     main:    A---B---C---E(.env)---M1---M2       (origin/main)
#                                    /     /
#                                   D     F
#
# Uso:
#   1. Trabalho genérico (features, fixes, docs — a maior parte):
#        git checkout base
#        # editar, testar, commitar
#        ./scripts/push-all.sh
#
#   2. Trabalho client-specific (raro — ex.: rotacionar chave Supabase):
#        git checkout main
#        # editar .env, commitar
#        ./scripts/push-all.sh

set -e

CURRENT=$(git rev-parse --abbrev-ref HEAD)

case "$CURRENT" in
  base)
    echo "→ Em branch 'base' — commits genéricos"
    echo "→ Push upstream main (fast-forward)..."
    git push upstream base:main

    echo "→ Trazendo novidades de 'base' para 'main' via merge..."
    git checkout main
    # --no-ff força merge commit quando main diverge; se main ja estiver
    # up-to-date com base (raro, ocorre apenas logo apos um merge sem
    # commits novos em base), vira no-op silencioso.
    git merge base --no-ff -m "merge: sync base into main" || {
      echo "✗ Conflito no merge base→main. Resolva manualmente, commit e rode de novo."
      exit 1
    }

    echo "→ Push origin main (fast-forward)..."
    git push origin main

    echo "→ Voltando para 'base'..."
    git checkout base

    echo "✓ upstream e origin sincronizados sem force-push."
    ;;

  main)
    echo "→ Em branch 'main' — commit client-specific"
    echo "→ Push origin main (fast-forward)..."
    git push origin main
    echo "✓ Feito. (upstream NÃO recebe esse commit — ok para client-only)"
    ;;

  *)
    echo "✗ Erro: este script só funciona em 'base' ou 'main'."
    echo "  Branch atual: $CURRENT"
    exit 1
    ;;
esac
