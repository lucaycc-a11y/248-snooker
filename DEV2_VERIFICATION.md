# Dev2 Panel + Deploy Controls - Verification Status

## Implementation Status: ✅ COMPLETED

All code has been implemented and pushed to `feat/homepage-hero-sections` (commits: a9a899c, ae04bfe).

---

## ✅ Completed Implementation

### 1. Core Components
- ✅ [components/uat/Dev2Panel.tsx](components/uat/Dev2Panel.tsx) - Full debug panel with 5 tabs
- ✅ [components/uat/MaintenanceBadge.tsx](components/uat/MaintenanceBadge.tsx) - Production maintenance badge
- ✅ [lib/uat/activity-logger.ts](lib/uat/activity-logger.ts) - Console/fetch capture

### 2. API Routes - UAT Features
- ✅ [app/api/uat/env-info/route.ts](app/api/uat/env-info/route.ts) - Environment details
- ✅ [app/api/uat/ip-whitelist/route.ts](app/api/uat/ip-whitelist/route.ts) - IP whitelist CRUD (admin-only)
- ✅ [app/api/uat/delete-test-bookings/route.ts](app/api/uat/delete-test-bookings/route.ts) - Safe test data cleanup

### 3. API Routes - Deploy Controls
- ✅ [app/api/deploy/info/route.ts](app/api/deploy/info/route.ts) - Branch states via GitHub API
- ✅ [app/api/deploy/push-to-maintenance/route.ts](app/api/deploy/push-to-maintenance/route.ts) - Merge uat→main + enable gate
- ✅ [app/api/deploy/go-live/route.ts](app/api/deploy/go-live/route.ts) - Disable gate only
- ✅ [app/api/maintenance/gate-status/route.ts](app/api/maintenance/gate-status/route.ts) - Badge visibility check

### 4. Security Features
- ✅ All UAT routes gated by `NEXT_PUBLIC_APP_ENV === 'uat'`
- ✅ All deploy routes require `admin_users.is_active = true`
- ✅ Typed confirmation for destructive actions (PUSH TO MAINTENANCE / GO LIVE)
- ✅ In-flight lock via `config.deploy_merge_in_progress` to prevent concurrent merges
- ✅ Audit logging for all deploy/gate actions
- ✅ GITHUB_TOKEN server-side only, never exposed to client

---

## 🔧 Configuration Required (Before Testing)

### Vercel Environment Variables
Add to both UAT and production environments:

```bash
# UAT branch only
NEXT_PUBLIC_APP_ENV=uat

# Both environments (deploy controls)
GITHUB_TOKEN=<personal_access_token_with_repo_scope>

# Optional (future: Vercel API integration)
VERCEL_TOKEN=<vercel_api_token>
```

### GitHub Personal Access Token
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with scopes: `repo` (full control)
3. Add as `GITHUB_TOKEN` in Vercel environment variables

---

## ⚠️ Pending Verification (User Testing Required)

### Non-Admin User Tests (UAT)
- [ ] UAT badge → dev2 panel opens
- [ ] Activity Log tab: console/fetch events captured, copy/clear works
- [ ] Env Info tab: shows correct user details
- [ ] Quick Actions tab: "Delete My Test Bookings" only deletes is_test=true rows
- [ ] IP Whitelist tab: NOT visible (non-admin)
- [ ] Deploy tab: NOT visible (non-admin)

### Admin User Tests (UAT)
- [ ] IP Whitelist tab visible and functional
- [ ] Deploy tab visible
- [ ] Deploy tab shows main/uat branch SHAs (requires GITHUB_TOKEN)
- [ ] "Push to Maintenance" button disabled when branches equal
- [ ] Typing confirmation text enables "Push to Maintenance" button

### Push to Maintenance Flow
- [ ] Type "PUSH TO MAINTENANCE" (exact text required)
- [ ] Submit → merge uat→main succeeds
- [ ] `site_gate_config.enabled` set to true
- [ ] `audit_log` entry created with action='push_to_maintenance'
- [ ] Vercel auto-deploys main branch to production

### Production Maintenance Badge
- [ ] Visit `space8.com.hk` from non-whitelisted IP → see coming-soon, NO badge visible
- [ ] Visit `space8.com.hk` from whitelisted IP → see real site + red maintenance badge bottom-left
- [ ] Tap maintenance badge → dev2 panel opens in production-review mode
- [ ] Deploy tab visible (admin only)
- [ ] IP Whitelist / Activity Log tabs work same as UAT

### Go Live Flow
- [ ] "Go Live" button only enabled when gate is enabled
- [ ] Type "GO LIVE" (exact text required)
- [ ] Submit → `site_gate_config.enabled` set to false
- [ ] `audit_log` entry created with action='end_maintenance'
- [ ] Maintenance badge disappears for all visitors
- [ ] Public visitors can now see production site (no 503)

### Concurrent Merge Protection
- [ ] Open two admin browsers
- [ ] Submit "Push to Maintenance" from both simultaneously
- [ ] Second request should fail with "A merge is already in progress"
- [ ] Check `config.deploy_merge_in_progress` lock is released after completion

### Security Verification
- [ ] Open DevTools Network tab
- [ ] Trigger deploy actions
- [ ] Confirm GITHUB_TOKEN never appears in any request/response
- [ ] Confirm all deploy routes return 403 for non-admin users

---

## 🐛 Known Limitations

1. **GitHub API Rate Limits**: Anonymous requests limited to 60/hour. With GITHUB_TOKEN: 5000/hour.
2. **Merge Conflicts**: If uat→main merge has conflicts, the API returns an error. Manual resolution required via git CLI.
3. **Vercel Deployment Tracking**: Currently no live polling of Vercel deployment status. Deploy info endpoint returns commit SHA only.
4. **Stale Lock Recovery**: Merge locks auto-expire after 5 minutes. If a deploy crashes, wait 5min before retrying.

---

## 📋 Next Steps

1. **Add GITHUB_TOKEN** to Vercel environment variables
2. **Test non-admin flow** on UAT (verify tabs are hidden)
3. **Test admin flow** on UAT (verify all tabs work)
4. **Test full deploy workflow**:
   - Make a change on uat branch
   - Push to Maintenance → verify merge + gate enable
   - Visit production → verify maintenance badge
   - Go Live → verify gate disable + badge disappears
5. **Test concurrent merge protection** (two admins)
6. **Security audit**: Verify GITHUB_TOKEN never exposed

---

## 🔗 Related Files

- [UAT_DEPLOYMENT_CHECKLIST.md](UAT_DEPLOYMENT_CHECKLIST.md) - Original UAT environment deployment checklist
- [.impeccable/config.json](.impeccable/config.json) - Design system suppressions for UAT components
- [app/layout.tsx](app/layout.tsx) - Both badges integrated

---

## Commit History

- `4588ee6` - UAT environment + Maintenance Gate enhancements
- `a9a899c` - dev2 debug panel for UAT environment
- `ae04bfe` - deploy controls + maintenance badge for production review
