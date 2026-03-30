#!/usr/bin/env bash
#
# Creates the RentalOS subscription product + 6 prices in Stripe.
# Usage: STRIPE_SECRET_KEY=sk_test_xxx bash scripts/stripe-seed.sh
#
# Run this against your TEST mode key first, then LIVE when ready.

set -euo pipefail

if [ -z "${STRIPE_SECRET_KEY:-}" ]; then
  echo "Error: Set STRIPE_SECRET_KEY before running."
  echo "  STRIPE_SECRET_KEY=sk_test_xxx bash scripts/stripe-seed.sh"
  exit 1
fi

API="https://api.stripe.com/v1"
AUTH="-u ${STRIPE_SECRET_KEY}:"

echo "=== Creating RentalOS product ==="
PRODUCT_ID=$(curl -s $AUTH "$API/products" \
  -d "name=RentalOS Subscription" \
  -d "description=SaaS platform for party rental businesses" \
  -d "metadata[app]=rentalos" \
  | grep -o '"id": "prod_[^"]*"' | head -1 | cut -d'"' -f4)

echo "Product: $PRODUCT_ID"

echo ""
echo "=== Creating Starter Monthly ($49/mo) ==="
STARTER_MONTHLY=$(curl -s $AUTH "$API/prices" \
  -d "product=$PRODUCT_ID" \
  -d "unit_amount=4900" \
  -d "currency=usd" \
  -d "recurring[interval]=month" \
  -d "nickname=Starter Monthly" \
  -d "metadata[tier]=starter" \
  -d "metadata[interval]=monthly" \
  | grep -o '"id": "price_[^"]*"' | head -1 | cut -d'"' -f4)
echo "  $STARTER_MONTHLY"

echo "=== Creating Starter Yearly ($39/mo = $468/yr) ==="
STARTER_YEARLY=$(curl -s $AUTH "$API/prices" \
  -d "product=$PRODUCT_ID" \
  -d "unit_amount=46800" \
  -d "currency=usd" \
  -d "recurring[interval]=year" \
  -d "nickname=Starter Yearly" \
  -d "metadata[tier]=starter" \
  -d "metadata[interval]=yearly" \
  | grep -o '"id": "price_[^"]*"' | head -1 | cut -d'"' -f4)
echo "  $STARTER_YEARLY"

echo "=== Creating Pro Monthly ($99/mo) ==="
PRO_MONTHLY=$(curl -s $AUTH "$API/prices" \
  -d "product=$PRODUCT_ID" \
  -d "unit_amount=9900" \
  -d "currency=usd" \
  -d "recurring[interval]=month" \
  -d "nickname=Pro Monthly" \
  -d "metadata[tier]=pro" \
  -d "metadata[interval]=monthly" \
  | grep -o '"id": "price_[^"]*"' | head -1 | cut -d'"' -f4)
echo "  $PRO_MONTHLY"

echo "=== Creating Pro Yearly ($79/mo = $948/yr) ==="
PRO_YEARLY=$(curl -s $AUTH "$API/prices" \
  -d "product=$PRODUCT_ID" \
  -d "unit_amount=94800" \
  -d "currency=usd" \
  -d "recurring[interval]=year" \
  -d "nickname=Pro Yearly" \
  -d "metadata[tier]=pro" \
  -d "metadata[interval]=yearly" \
  | grep -o '"id": "price_[^"]*"' | head -1 | cut -d'"' -f4)
echo "  $PRO_YEARLY"

echo "=== Creating Growth Monthly ($199/mo) ==="
GROWTH_MONTHLY=$(curl -s $AUTH "$API/prices" \
  -d "product=$PRODUCT_ID" \
  -d "unit_amount=19900" \
  -d "currency=usd" \
  -d "recurring[interval]=month" \
  -d "nickname=Growth Monthly" \
  -d "metadata[tier]=growth" \
  -d "metadata[interval]=monthly" \
  | grep -o '"id": "price_[^"]*"' | head -1 | cut -d'"' -f4)
echo "  $GROWTH_MONTHLY"

echo "=== Creating Growth Yearly ($159/mo = $1,908/yr) ==="
GROWTH_YEARLY=$(curl -s $AUTH "$API/prices" \
  -d "product=$PRODUCT_ID" \
  -d "unit_amount=190800" \
  -d "currency=usd" \
  -d "recurring[interval]=year" \
  -d "nickname=Growth Yearly" \
  -d "metadata[tier]=growth" \
  -d "metadata[interval]=yearly" \
  | grep -o '"id": "price_[^"]*"' | head -1 | cut -d'"' -f4)
echo "  $GROWTH_YEARLY"

echo ""
echo "========================================="
echo "Done! Add these to your .env file:"
echo "========================================="
echo ""
echo "STRIPE_STARTER_MONTHLY_PRICE_ID=$STARTER_MONTHLY"
echo "STRIPE_STARTER_YEARLY_PRICE_ID=$STARTER_YEARLY"
echo "STRIPE_PRO_MONTHLY_PRICE_ID=$PRO_MONTHLY"
echo "STRIPE_PRO_YEARLY_PRICE_ID=$PRO_YEARLY"
echo "STRIPE_GROWTH_MONTHLY_PRICE_ID=$GROWTH_MONTHLY"
echo "STRIPE_GROWTH_YEARLY_PRICE_ID=$GROWTH_YEARLY"
echo ""
echo "Also set up your webhook endpoint in Stripe Dashboard:"
echo "  URL: https://your-domain.com/api/stripe/webhooks"
echo "  Events: checkout.session.completed, customer.subscription.created,"
echo "          customer.subscription.updated, customer.subscription.deleted,"
echo "          invoice.payment_failed"
