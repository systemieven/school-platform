#!/bin/bash
# Onboarding script for new school clients.
# Usage: ./scripts/new-client.sh <client-name> <supabase-project-ref>
#
# Prerequisites:
#   - gh CLI installed and authenticated
#   - supabase CLI installed and authenticated
#   - Access to systemieven GitHub org

set -euo pipefail

CLIENT_NAME="${1:?Usage: $0 <client-name> <supabase-project-ref>}"
PROJECT_REF="${2:?Usage: $0 <client-name> <supabase-project-ref>}"
ORG="systemieven"
BASE_REPO="$ORG/school-platform"
CLIENT_REPO="$ORG/$CLIENT_NAME"

echo "=== New Client Onboarding ==="
echo "Client:   $CLIENT_NAME"
echo "Repo:     $CLIENT_REPO"
echo "Supabase: $PROJECT_REF"
echo ""

# 1. Clone base repo as client
echo "1. Cloning base repo..."
gh repo clone "$BASE_REPO" "$CLIENT_NAME"
cd "$CLIENT_NAME"

# 2. Create client repo on GitHub
echo "2. Creating client repo on GitHub..."
gh repo create "$CLIENT_REPO" --private --source=. --remote=origin --push

# 3. Add upstream remote
echo "3. Adding upstream remote..."
git remote add upstream "https://github.com/$BASE_REPO.git"

# 4. Push migrations to Supabase
echo "4. Pushing migrations to Supabase..."
supabase db push --project-ref "$PROJECT_REF"

# 5. Deploy edge functions
echo "5. Deploying edge functions..."
supabase functions deploy --project-ref "$PROJECT_REF"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Create .env with your Supabase credentials:"
echo "     VITE_SUPABASE_PROJECT_ID=\"$PROJECT_REF\""
echo "     VITE_SUPABASE_URL=\"https://$PROJECT_REF.supabase.co\""
echo "     VITE_SUPABASE_PUBLISHABLE_KEY=\"<your-anon-key>\""
echo "     VITE_SCHOOL_NAME=\"<nome-da-escola>\""
echo "     VITE_SCHOOL_SHORT_NAME=\"<nome-curto>\""
echo "     VITE_SCHOOL_INITIALS=\"<sigla>\""
echo "     VITE_SCHOOL_SLOGAN=\"<slogan>\""
echo "     VITE_PORTAL_EMAIL_SUFFIX=\"@portal.<dominio>.com.br\""
echo ""
echo "  2. Create first admin user:"
echo "     curl -X POST https://$PROJECT_REF.supabase.co/functions/v1/create-admin-user \\"
echo "       -H 'Authorization: Bearer <service-role-key>' \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"email\":\"admin@escola.com\",\"password\":\"...\",\"full_name\":\"Admin\"}'"
echo ""
echo "  3. Configure branding via admin panel"
echo "  4. Copy .github/workflows/sync-upstream.yml for auto-sync"
