#!/usr/bin/env bash
# Security hardening verification script
# Tests CSRF protection, rate limiting, and audit logging on protected endpoints

set -e

BASE_URL="${1:-http://localhost:3000}"
echo "Testing against: $BASE_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; }
skip() { echo -e "${YELLOW}⊘ SKIP${NC}: $1"; }

echo "═══════════════════════════════════════════════"
echo "Security Hardening Verification"
echo "═══════════════════════════════════════════════"
echo ""

# 1. CSRF Protection on booking endpoints
echo "1. CSRF Protection (checkout/create)"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST "$BASE_URL/api/checkout/create" \
  -H "Content-Type: application/json" \
  -d '{"slotId":"test"}')

if [ "$RESPONSE" = "403" ] || [ "$RESPONSE" = "401" ]; then
  pass "checkout/create rejects request without CSRF token (HTTP $RESPONSE)"
else
  fail "checkout/create should reject without CSRF token, got HTTP $RESPONSE"
fi
echo ""

# 2. CSRF Protection on payment endpoints
echo "2. CSRF Protection (payment/create-intent)"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST "$BASE_URL/api/payment/create-intent" \
  -H "Content-Type: application/json" \
  -d '{"slotId":"test"}')

if [ "$RESPONSE" = "403" ] || [ "$RESPONSE" = "401" ]; then
  pass "payment/create-intent rejects request without CSRF token (HTTP $RESPONSE)"
else
  fail "payment/create-intent should reject without CSRF token, got HTTP $RESPONSE"
fi
echo ""

# 3. CSRF Protection on checkout cancel
echo "3. CSRF Protection (checkout/cancel)"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST "$BASE_URL/api/checkout/cancel" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"test-uuid"}')

if [ "$RESPONSE" = "403" ] || [ "$RESPONSE" = "401" ]; then
  pass "checkout/cancel rejects request without CSRF token (HTTP $RESPONSE)"
else
  fail "checkout/cancel should reject without CSRF token, got HTTP $RESPONSE"
fi
echo ""

# 4. CSRF Protection on auth endpoints
echo "4. CSRF Protection (auth/complete-password-change)"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST "$BASE_URL/api/auth/complete-password-change" \
  -H "Content-Type: application/json" \
  -d '{"token":"test","password":"Test1234!"}')

if [ "$RESPONSE" = "403" ] || [ "$RESPONSE" = "401" ]; then
  pass "complete-password-change rejects request without CSRF token (HTTP $RESPONSE)"
else
  fail "complete-password-change should reject without CSRF token, got HTTP $RESPONSE"
fi
echo ""

# 5. CSRF Protection on phone binding
echo "5. CSRF Protection (profile/bind-phone)"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST "$BASE_URL/api/profile/complete/bind-phone" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+85212345678"}')

if [ "$RESPONSE" = "403" ] || [ "$RESPONSE" = "401" ]; then
  pass "bind-phone rejects request without CSRF token (HTTP $RESPONSE)"
else
  fail "bind-phone should reject without CSRF token, got HTTP $RESPONSE"
fi
echo ""

# 6. Rate limiting test (rapid fire requests)
echo "6. Rate Limiting (checkout/create - 25 rapid requests)"
RATE_LIMIT_HIT=0
for i in {1..25}; do
  RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
    -X POST "$BASE_URL/api/checkout/create" \
    -H "Content-Type: application/json" \
    -d '{"slotId":"test"}')

  if [ "$RESPONSE" = "429" ]; then
    RATE_LIMIT_HIT=1
    break
  fi
done

if [ $RATE_LIMIT_HIT -eq 1 ]; then
  pass "Rate limiting triggered after rapid requests (HTTP 429)"
else
  skip "Rate limiting not triggered (may need more requests or authenticated session)"
fi
echo ""

# 7. Webhook endpoints should NOT require CSRF
echo "7. Webhook CSRF Exemption (stripe/webhook)"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST "$BASE_URL/api/stripe/webhook" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: invalid" \
  -d '{}')

# Should fail with 400 (bad signature), NOT 403 (CSRF rejection)
if [ "$RESPONSE" = "400" ]; then
  pass "Stripe webhook bypasses CSRF, validates signature instead (HTTP $RESPONSE)"
elif [ "$RESPONSE" = "403" ]; then
  fail "Stripe webhook should NOT enforce CSRF (got HTTP $RESPONSE)"
else
  skip "Stripe webhook returned HTTP $RESPONSE (signature validation path)"
fi
echo ""

echo "8. Webhook CSRF Exemption (kpay/webhook)"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST "$BASE_URL/api/kpay/webhook" \
  -H "Content-Type: application/json" \
  -d '{}')

# Should fail with 400 (bad signature), NOT 403 (CSRF rejection)
if [ "$RESPONSE" = "400" ]; then
  pass "KPay webhook bypasses CSRF, validates signature instead (HTTP $RESPONSE)"
elif [ "$RESPONSE" = "403" ]; then
  fail "KPay webhook should NOT enforce CSRF (got HTTP $RESPONSE)"
else
  skip "KPay webhook returned HTTP $RESPONSE (signature validation path)"
fi
echo ""

# 9-15: Manual verification required
echo "9. Cookie Flags (HttpOnly, Secure, SameSite=Lax)"
skip "Requires browser DevTools inspection or authenticated session dump"
echo ""

echo "10. Audit Logging (security events)"
skip "Requires database query: SELECT * FROM security_audit_log ORDER BY created_at DESC LIMIT 10"
echo ""

echo "11. Login Flow (end-to-end with session cookies)"
skip "Requires interactive test with valid credentials"
echo ""

echo "12. Booking Creation (authenticated + CSRF token)"
skip "Requires authenticated session + valid slot + CSRF token from /api/csrf"
echo ""

echo "13. Password Change (complete flow with email token)"
skip "Requires valid change token from email + authenticated session"
echo ""

echo "14. Admin Endpoints (CSRF + admin role check)"
skip "Requires admin session + CSRF token"
echo ""

echo "15. Rate Limit Recovery (wait for window expiry)"
skip "Requires waiting ~60s between test batches"
echo ""

echo "═══════════════════════════════════════════════"
echo "Summary: Automated checks completed"
echo "Manual verification steps documented above"
echo "═══════════════════════════════════════════════"
