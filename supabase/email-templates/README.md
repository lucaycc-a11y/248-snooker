# Space8 Email Templates — Supabase Auth

Space-themed email templates for all Supabase Auth events. All templates use black (#000000) background, green (#22c55e) CTAs, CSS starfield effects, and a large brand logo at the top.

## ⚠️ Important: Logo Setup Required

All email templates reference a PNG logo at:
```
https://248.formhk.com/logos/space8-logo-email.png
```

**This PNG must be created and uploaded before the emails will display correctly.** Follow these steps:

### Step 1: Convert SVG to PNG

Run the conversion script:
```bash
node scripts/convert-logo-for-email.js
```

This converts `public/logos/Space8_full_icon_white_black_bkg.svg` to a high-resolution PNG (960px width @3x) at `public/logos/space8-logo-email.png`.

**Requirements:** Install `sharp` if not already installed:
```bash
npm install sharp --save-dev
```

### Step 2: Upload PNG to Hosting

The PNG must be publicly accessible at the URL referenced in the templates. Options:

- **Vercel:** Deploy and the file in `public/logos/` will be accessible at `https://248.formhk.com/logos/space8-logo-email.png`
- **Manual upload:** Upload to your CDN/hosting and verify the URL matches

### Step 3: Verify

Open this URL in a browser to confirm it loads:
```
https://248.formhk.com/logos/space8-logo-email.png
```

The logo should display as white Space8 branding on transparent/black background.

## Templates

1. **confirm-signup.html** — Email confirmation for new signups
2. **invite.html** — Team/user invitation email
3. **magic-link.html** — Magic link + OTP code for passwordless login
4. **change-email.html** — Confirm new email address
5. **reset-password.html** — Password reset link
6. **reauthentication.html** — Re-authentication verification
7. **password-changed.html** — Notification when password is changed
8. **email-changed.html** — Notification when email is changed
9. **phone-changed.html** — Notification when phone is changed

## Deployment

### Via Supabase Dashboard

1. Navigate to **Authentication → Email Templates** in the Supabase Dashboard
2. For each template:
   - Select the corresponding template type from the dropdown
   - Copy the HTML from the respective `.html` file
   - Paste into the template editor
   - Click **Save**

### Via Supabase CLI

```bash
# Update all templates at once
supabase db remote set auth.email.templates.confirm_signup "$(cat supabase/email-templates/confirm-signup.html)"
supabase db remote set auth.email.templates.invite_user "$(cat supabase/email-templates/invite.html)"
supabase db remote set auth.email.templates.magic_link "$(cat supabase/email-templates/magic-link.html)"
supabase db remote set auth.email.templates.change_email "$(cat supabase/email-templates/change-email.html)"
supabase db remote set auth.email.templates.reset_password "$(cat supabase/email-templates/reset-password.html)"
supabase db remote set auth.email.templates.reauthentication "$(cat supabase/email-templates/reauthentication.html)"
supabase db remote set auth.email.templates.password_changed "$(cat supabase/email-templates/password-changed.html)"
supabase db remote set auth.email.templates.email_changed "$(cat supabase/email-templates/email-changed.html)"
supabase db remote set auth.email.templates.phone_changed "$(cat supabase/email-templates/phone-changed.html)"
```

## Template Variables

Supabase automatically populates these variables:

- `{{ .ConfirmationURL }}` — Action link (confirm, reset, etc.)
- `{{ .Token }}` — OTP code (magic link template only)
- `{{ .Time }}` — Timestamp of the action
- `{{ .IPAddress }}` — IP address of the requester
- `{{ .NewEmail }}` — New email address (email-changed template)
- `{{ .NewPhone }}` — New phone number (phone-changed template)

## Design System

- **Background:** Pure black (#000000)
- **Primary text:** Near-white (#ffffff)
- **Secondary text:** Gray (#a3a3a3, #737373, #525252)
- **CTA button:** Green (#22c55e) background, black text
- **Card background:** Dark gray (#0a0a0a) with green border
- **Borders:** Semi-transparent white/green (#262626, rgba(34,197,94,0.2))
- **Font:** System font stack (SF Pro Display, -apple-system)
- **Display font:** Bebas Neue for logo

## Testing

Before deploying to production, test each template:

1. **Logo Display:** Verify the logo PNG loads correctly (white Space8 branding, ~320px display width)
2. Trigger the respective auth flow in a staging environment
3. Check email rendering in:
   - Gmail (web + mobile app)
   - Outlook (web + desktop) — **Critical:** Outlook has the strictest image/CSS support
   - iOS Mail
   - Android Gmail
4. Verify all links work correctly
5. Confirm starfield effects render (CSS-only, no JS)
6. Confirm logo displays at appropriate size (large and prominent, not tiny)

## Browser Compatibility

- All templates use inline CSS for maximum email client compatibility
- Starfield effect is decorative and gracefully degrades in clients that don't support absolute positioning
- Tested in Gmail, Outlook, Apple Mail, and Fastmail

## Notes

- **Logo is PNG, not SVG** — Email clients (especially Outlook) don't reliably support SVG. The logo must be converted to PNG and hosted at an absolute URL before emails will display correctly.
- **No external dependencies beyond logo** — Besides the hosted logo PNG, all visuals are CSS-based (starfield, checkmarks)
- **No JavaScript** — Pure HTML + inline CSS only
- **Responsive** — Mobile-first design with max-width constraints
- **Dark mode compatible** — Already dark-themed, no light mode variant needed
- **Accessibility** — Semantic HTML, sufficient color contrast, clear CTAs, logo has alt="Space8"
