#!/bin/bash
echo "Testing /member route accessibility..."
echo ""
echo "1. Testing production (space8.com.hk):"
curl -sI https://space8.com.hk/member 2>&1 | grep -E "HTTP|location|Location" | head -5
echo ""
echo "2. Checking if /member page file exists:"
ls -la app/member/page.tsx
echo ""
echo "3. Checking middleware BYPASS_PREFIXES:"
grep -n "BYPASS_PREFIXES = \[" middleware.ts -A 1
echo ""
echo "4. Recent commits touching /member or auth:"
git log --oneline --since="30 days ago" | grep -iE "(member|oauth|auth)" | head -10
