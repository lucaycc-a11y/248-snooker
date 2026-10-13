# i18n Pending Translations

## Current Status

**Active locale:** zh-HK (Traditional Chinese) only

**Closed locales:** zh-CN (Simplified Chinese), en (English)

Closed locales can be reopened by adding them back to `ENABLED_LOCALES` in `i18n/enabled-locales.ts`.

## Translation Workflow

While zh-CN and en are closed, only zh-HK strings are being edited. New or changed string keys will be recorded here so translations can catch up when a locale is reopened.

### Pending Keys (to be translated when locales reopen)

_None yet — this file was created on 2026-10-04 when zh-CN and en were closed._

---

## How to Track Changes

When adding or modifying zh-HK strings:

1. Update `messages/zh-HK.json` with the new/changed key
2. Add an entry below listing:
   - The key path (e.g. `member.wallet.title`)
   - The zh-HK text
   - Date added
   - Brief context if needed

When reopening a locale:

1. Translate all pending keys
2. Update `messages/zh-CN.json` and `messages/en.json`
3. Clear the pending list below
4. Add the locale to `ENABLED_LOCALES`

---

## Example Entry Format

```
### 2026-10-15

- `booking.confirmation.title` — "預訂確認"
  - Context: New booking confirmation page title
- `member.points.expired` — "已過期積分: {count}"
  - Context: Shows expired points count in wallet
```
