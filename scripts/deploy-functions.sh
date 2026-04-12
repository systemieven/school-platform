#!/bin/bash
# Deploy all Edge Functions to client Supabase projects.
# Usage: ./scripts/deploy-functions.sh
#
# Requires: supabase CLI installed and authenticated.

set -euo pipefail

CLIENTS=(
  # Add client project refs here:
  # "ref-cliente-a"
  # "ref-cliente-b"
)

if [ ${#CLIENTS[@]} -eq 0 ]; then
  echo "No clients configured. Edit CLIENTS array in this script."
  exit 1
fi

for ref in "${CLIENTS[@]}"; do
  echo "==> Deploying functions to $ref..."
  supabase functions deploy --project-ref "$ref"
  echo "    Done."
done

echo ""
echo "All functions deployed successfully."
