#!/bin/bash
# Push Supabase migrations to all client projects.
# Usage: ./scripts/push-migrations.sh
#
# Reads project refs from CLIENTS array below.
# Requires: supabase CLI installed and authenticated.

set -euo pipefail

CLIENTS=(
  # Add client project refs here, one per line:
  # "ref-cliente-a"
  # "ref-cliente-b"
)

if [ ${#CLIENTS[@]} -eq 0 ]; then
  echo "No clients configured. Edit CLIENTS array in this script."
  exit 1
fi

for ref in "${CLIENTS[@]}"; do
  echo "==> Pushing migrations to $ref..."
  supabase db push --project-ref "$ref"
  echo "    Done."
done

echo ""
echo "All migrations pushed successfully."
