#!/usr/bin/env bash
# Tier-4 residual coverage — walk Phase 2 across one vertical end-to-end.
#
# Resets the operator org via the Supabase MCP-style admin SQL, flips
# business_type + organization_verticals + the seeded categories to the
# target vertical, then runs Phase 1 + Phase 2 specs against either the
# preview (set E2E_BASE_URL + E2E_VERCEL_BYPASS_TOKEN) or live prod
# (default). Pass the vertical slug as the first arg.
#
# Usage:
#   ./scripts/e2e-walk-vertical.sh tents
#   E2E_BASE_URL=https://… E2E_VERCEL_BYPASS_TOKEN=… ./scripts/e2e-walk-vertical.sh tables-and-chairs
set -euo pipefail

vertical=${1:?usage: $0 <vertical-slug>}
echo "[walk] vertical=$vertical"

case "$vertical" in
  tents)
    slug="e2e-20x40-frame-tent"; subtotal="650";;
  tables-and-chairs)
    slug="e2e-chiavari-chair-gold"; subtotal="350"; export E2E_CHECKOUT_BELOW_MINIMUM=1;;
  dance-floors)
    slug="e2e-12x12-parquet-dance-floor"; subtotal="450";;
  photo-booths)
    slug="e2e-open-air-photo-booth"; subtotal="600";;
  concessions)
    slug="e2e-popcorn-machine"; subtotal="175";;
  inflatable)
    slug="e2e-13ft-castle-bouncer"; subtotal="165";;
  *)
    echo "unknown vertical: $vertical" >&2; exit 2;;
esac

PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
E2E_OPERATOR_EMAIL="${E2E_OPERATOR_EMAIL:-komlankouhiko@icloud.com}" \
E2E_OPERATOR_PASSWORD="${E2E_OPERATOR_PASSWORD:-Fuck2chainz!}" \
E2E_PRODUCT_SLUG="$slug" \
E2E_ORDER_SUBTOTAL="$subtotal" \
  npx playwright test --config playwright.e2e.config.ts \
    "tests/e2e/${vertical}.spec.ts" \
    "tests/e2e/${vertical}2.spec.ts" \
    --reporter=line
