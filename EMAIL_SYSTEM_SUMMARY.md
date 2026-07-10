# Space8 Email Template System — Implementation Summary

## 🎯 Scope Completed

### 1. ✅ Unified QR Code Generation System (lib/qrcode.ts)
- Central QR generation for all use cases (booking, member, admin)
- GM65 scanner compatibility (error correction 'M', 4px margin, black on white)
- Configurable output formats: data URL or buffer
- Recommended sizes for email (320px), print (500px), display (300px)

**Key exports:**
- `generateBookingQR()` — JWT token + TOTP backup code
- `generateMemberQR()` — Member code only
- `generateAdminQR()` — Admin JWT token
- `getRecommendedQRSize()` — Size recommendations

### 2. ✅ Booking Confirmation Email (lib/resend/templates/booking-confirmed.tsx)
- Embedded QR code via base64 data URL
- TOTP backup code display (248-XXXXXXXX-XXXX-CC format)
- Integrated into `lib/resend/send.ts`
- Supports zh-HK and en locales

**Visual design:**
- QR code in white-background box with green glow shadow
- Backup code in monospace green text with clear instructions
- Space-themed black background with starfield effects

### 3. ✅ Member Dashboard Real QR Code (app/member/MemberDashboard.tsx)
- Replaced decorative QRGlyph SVG with real scannable QR
- Generates on mount via useEffect
- Uses member_code from database
- Graceful fallback while loading
- Same 76px size, no layout shift

### 4. ✅ All 9 Supabase Auth Email Templates Redesigned

All templates now feature:
- **Large brand logo** at top (320px width, 960px @3x PNG)
- Black background (#000000) with space theme
- Green CTA buttons (#22c55e)
- CSS-only starfield effects (5 white dots with glow)
- Table-based layout for email client compatibility
- Inline CSS throughout (required for email clients)

**Templates completed:**
1. confirm-signup.html — Email confirmation for new signups
2. invite.html — Team/user invitation email
3. magic-link.html — Magic link + OTP code (large green monospace display)
4. change-email.html — Confirm new email address
5. reset-password.html — Password reset link
6. reauthentication.html — Re-authentication verification
7. password-changed.html — Notification with time/IP display
8. email-changed.html — Notification with new email/time/IP
9. phone-changed.html — Notification with new phone/time/IP

**Logo specification:**
- Source: `public/logos/Space8_full_icon_white_black_bkg.svg`
- Output: `public/logos/space8-logo-email.png` (960px width @3x)
- Display: 320px width (53% of 600px email container)
- URL: `https://248.formhk.com/logos/space8-logo-email.png`

## 🔧 Tools Created

### scripts/convert-logo-for-email.js
Node.js script to convert SVG logo to high-resolution PNG for email templates.

**Usage:**
```bash
npm install sharp --save-dev
node scripts/convert-logo-for-email.js
```

**Output:** `public/logos/space8-logo-email.png` (960px × ~527px @3x resolution)

## 📋 Remaining Tasks

### 1. Convert and Upload Logo PNG
**Priority: HIGH** — Emails won't display correctly until this is done.

Steps:
```bash
# 1. Install sharp (if not already installed)
npm install sharp --save-dev

# 2. Run conversion script
node scripts/convert-logo-for-email.js

# 3. Deploy or upload the PNG
# Vercel: Deploy and it's automatically available at public URL
# Manual: Upload to CDN and verify URL matches template references

# 4. Verify
# Open https://248.formhk.com/logos/space8-logo-email.png
# Should show white Space8 logo on transparent/black background
```

### 2. Upload Auth Templates to Supabase
Navigate to Supabase Dashboard → Authentication → Email Templates

For each template type, copy HTML from corresponding file and paste into editor:
- Confirm signup → `confirm-signup.html`
- Invite user → `invite.html`
- Magic link → `magic-link.html`
- Change email → `change-email.html`
- Reset password → `reset-password.html`
- Reauthentication → `reauthentication.html`
- Password changed → `password-changed.html`
- Email changed → `email-changed.html`
- Phone changed → `phone-changed.html`

### 3. Test Email Templates
**Critical email clients to test:**
- Gmail (web + mobile app)
- **Outlook** (web + desktop) — Most restrictive, highest priority
- iOS Mail
- Android Gmail

**What to verify:**
- ✅ Logo displays at correct size (large and prominent, ~320px width)
- ✅ Logo loads (not broken image icon)
- ✅ Green CTA buttons are visible and clickable
- ✅ Starfield effects render (may degrade gracefully in some clients)
- ✅ All links work correctly
- ✅ Text is readable on black background
- ✅ Mobile responsive layout works

### 4. Test QR Codes with GM65 Scanner
Hardware testing required:
- Booking confirmation email QR code → door access
- Member dashboard QR code → door access
- Backup code entry flow (if QR fails)

### 5. Fix Admin QR Endpoint (if needed)
Current endpoint may only return JWT token. Should return actual QR code image.

Location: `app/api/admin/generate-qr` (or similar)

## 📂 Files Modified/Created

### New Files
- `lib/qrcode.ts` — Unified QR generation system
- `supabase/email-templates/confirm-signup.html`
- `supabase/email-templates/invite.html`
- `supabase/email-templates/magic-link.html`
- `supabase/email-templates/change-email.html`
- `supabase/email-templates/reset-password.html`
- `supabase/email-templates/reauthentication.html`
- `supabase/email-templates/password-changed.html`
- `supabase/email-templates/email-changed.html`
- `supabase/email-templates/phone-changed.html`
- `supabase/email-templates/README.md` — Deployment guide
- `scripts/convert-logo-for-email.js` — SVG to PNG conversion script

### Modified Files
- `lib/resend/templates/booking-confirmed.tsx` — Added QR + backup code
- `lib/resend/send.ts` — Integrated QR generation
- `app/member/MemberDashboard.tsx` — Real QR code generation

## 🎨 Design System Summary

### Colors
- Background: Pure black `#000000`
- Primary text: Near-white `#ffffff`
- Secondary text: Gray `#a3a3a3`, `#737373`, `#525252`
- CTA button: Green `#22c55e` background, black text
- Card background: Dark gray `#0a0a0a`
- Borders: `#262626`, `rgba(34,197,94,0.2)`

### Typography
- Body: System font stack (SF Pro Display, -apple-system)
- Logo: Bebas Neue (only in conversion script context)
- Code/tokens: SF Mono, monospace

### Layout
- Email container: 600px max-width
- Logo: 320px width (53% of container)
- Card: 24px border-radius, 1px green border
- Padding: 48px vertical, 24px horizontal (mobile-first)

## ⚠️ Critical Notes

1. **Logo PNG is required** — All templates reference `https://248.formhk.com/logos/space8-logo-email.png`. Emails will show broken image until PNG is created and uploaded.

2. **Test in Outlook** — Outlook has the strictest email rendering. If it works in Outlook, it will work everywhere.

3. **Absolute URLs only** — Email clients require absolute URLs for images. Relative paths will not work.

4. **No SVG in emails** — SVG support is unreliable across email clients. PNG is mandatory.

5. **QR scanner compatibility** — All QR codes use error correction level 'M' and 4px margin for GM65 scanner compatibility.

## 📊 Implementation Stats

- **Templates created:** 9 Supabase Auth + 1 booking confirmation
- **Total lines of code added:** ~1,500+
- **QR generation functions:** 3 specialized + 1 unified base
- **Email clients to test:** 4 (Gmail, Outlook, iOS Mail, Android Gmail)
- **Logo resolution:** 960px × ~527px @3x (320px display size)

## 🚀 Next Action

**Immediate:** Run logo conversion script and upload PNG to hosting.

```bash
node scripts/convert-logo-for-email.js
```

Once PNG is uploaded and accessible at the public URL, the email system is fully functional and ready for production testing.
