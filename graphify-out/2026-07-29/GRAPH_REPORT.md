# Graph Report - Space8_web  (2026-07-29)

## Corpus Check
- 446 files · ~781,826 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1810 nodes · 3272 edges · 237 communities (178 shown, 59 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 99 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ae96381a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- createClient
- getMember.ts
- config/route.ts
- handler.js
- book/page.tsx
- MemberDashboard.tsx
- send.ts
- devDependencies
- [slug]/page.tsx
- 248 Snooker Club
- getAdminData
- tokens.ts
- tools.ts
- createClient
- compilerOptions
- whatsapp-bot/package.json
- middleware.ts
- SiteGateLog.tsx
- Planet3D.tsx
- LegalContent.tsx
- translate/route.ts
- Snooker404Table.tsx
- StripePayment.tsx
- getServiceSupabase
- SettingsForm.tsx
- FAQ.tsx
- legal/index.ts
- TicketCard.tsx
- TeamTable.tsx
- humanReadableCode
- ui/index.ts
- getConfig
- Quick Deployment Guide — Payment Fixes
- navigation.ts
- Button.tsx
- Nav.tsx
- cms-sync.mjs
- getAdminCalendar.ts
- HowItWorks.tsx
- cms-seed-from-messages.mjs
- Efficient Engineering
- Door Lock API Routes
- dependencies
- AiSettingsForm.tsx
- AboutContent.tsx
- Apple UI Design Skill
- Apple UI Design
- Security & Backend
- seed-cms-from-messages.mjs
- Web Application Testing
- profile.ts
- Member.tsx
- Booking Flow
- Gallery.tsx
- cms-audit.mjs
- Supabase Email Templates README
- planetSystem.ts
- VenueContent.tsx
- Graphify
- 248 Snooker Club
- service.ts
- member/page.tsx
- getAdminMembers.ts
- i18n-locale-audit.mjs
- legal/page.tsx
- ComingSoonContent.tsx
- 248 Booking Flow Skill
- site-gate/route.ts
- convert-logo-for-email.js
- merge-messages.mjs
- build_merge function
- door-lock/page.tsx
- AdminAIPanel.tsx
- blog/route.ts
- Hybrid CMS Architecture
- count_sections
- backfill-human-codes.mjs
- is_server_ready
- bookings/route.ts
- backup-password/route.ts
- validate-password/route.ts
- validate-qr/route.ts
- notify/route.ts
- AuthCard.tsx
- PlanetReveal Canvas Component
- next.config.js
- PR Review command
- URL ingestion pipeline
- Cross-repo merge pipeline
- Video transcription pipeline
- door-status/route.ts
- generate-qr/route.ts
- active-bookings-cache/route.ts
- admin-override/route.ts
- poll-commands/route.ts
- validate-nfc/route.ts
- kebab-case naming
- Login Page Crash Fix
- Client-Side Payment Logging
- Supabase Auth Email Templates
- cards/[id]/route.ts
- remotion/index.ts
- graphify benchmark command
- CLAUDE.md native integration
- Git post-commit hook
- members/[id]/page.tsx
- efficient-engineering skill
- TOTP Password Validation API
- Member Page Profile Completion Gate
- framer-motion
- leaflet
- animations.ts
- BookingTable.tsx
- next
- next-intl
- react
- react-dom
- @react-email/render
- react-leaflet
- @react-three/fiber
- recharts
- remotion
- @remotion/cli
- @remotion/player
- stripe
- @stripe/react-stripe-js
- @stripe/stripe-js
- @supabase/ssr
- @supabase/supabase-js
- three
- @tiptap/react
- qrcode
- @types/canvas-confetti
- @ybouane/liquidglass
- rotate-apple-secret/index.ts
- tailwind.config.ts
- apple-ui skill
- booking-flow skill
- git-workflow skill
- nextjs-patterns skill
- security-backend skill
- webapp-testing skill
- graphify watch mode
- graphify cluster-only command
- Apache License 2.0
- data-cms-key constraint
- Stripe Checkout Sessions Migration Consideration
- getAdminMembers
- generate-image/route.ts
- confirm/route.ts
- Space8 Club Information for LLMs
- WhatsApp Bot Render Deploy Config
- Security & Backend Skill
- resend
- Installation Required
- Next.js 14 App Router Patterns
- AGENTS.md
- Efficient Engineering
- Git Workflow Skill
- Karpathy Guidelines
- useNfcRegistrationStatus.ts
- [locale]/page.tsx
- lucide-react
- @tiptap/extension-image
- @tiptap/extension-link
- team/[id]/route.ts
- register-request/route.ts
- access-log/route.ts

## God Nodes (most connected - your core abstractions)
1. `getServiceSupabase()` - 119 edges
2. `getAdminData()` - 69 edges
3. `Tokens` - 46 edges
4. `createClient()` - 38 edges
5. `rateLimit()` - 34 edges
6. `num()` - 23 edges
7. `createClient()` - 22 edges
8. `Card()` - 21 edges
9. `Button` - 20 edges
10. `clientIp()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `AdminBookingsPage()` --calls--> `getAdminBookings()`  [EXTRACTED]
  app/admin/bookings/page.tsx → lib/data/getAdminBookings.ts
- `AdminDoorPage()` --calls--> `getAdminDoorCards()`  [EXTRACTED]
  app/admin/door/page.tsx → lib/data/getAdminDoorCards.ts
- `Web Application Testing` --conceptually_related_to--> `Efficient Engineering`  [INFERRED]
  .agents/skills/webapp-testing/SKILL.md → .claude/skills/efficient-engineering/SKILL.md
- `graphify knowledge graph` --conceptually_related_to--> `graphify path command`  [INFERRED]
  CLAUDE.md → .claude/skills/graphify/references/query.md
- `graphify knowledge graph` --conceptually_related_to--> `graphify explain command`  [INFERRED]
  CLAUDE.md → .claude/skills/graphify/references/query.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **248 Snooker Club Project Skills** — claude_skills_apple-ui_skill_apple_ui_design, claude_skills_booking-flow_skill_booking_flow, claude_skills_git-workflow_skill_git_workflow, claude_skills_karpathy-guidelines_skill_karpathy_guidelines, claude_skills_nextjs-patterns_skill_nextjs_14_app_router_patterns, claude_skills_security-backend_skill_security_and_backend, claude_skills_efficient-engineering_skill_efficient_engineering [EXTRACTED 1.00]
- **Booking Payment Flow** — claude_skills_booking-flow_skill_booking_flow, claude_skills_booking-flow_skill_stripe_flow, claude_skills_booking-flow_skill_slot_locking, claude_skills_booking-flow_skill_pricing_logic, claude_skills_security-backend_skill_qr_code_spec, claude_skills_security-backend_skill_auth_architecture, claude_skills_security-backend_skill_api_security [INFERRED 0.95]
- **Graphify Extraction Pipeline** — claude_skills_graphify_skill_graphify, claude_skills_graphify_skill_ast_extraction, claude_skills_graphify_skill_semantic_extraction, claude_skills_graphify_skill_community_detection, claude_skills_graphify_skill_knowledge_graph, claude_skills_graphify_skill_honesty_rules [EXTRACTED 1.00]
- **Graphify CLI commands** — _claude_skills_graphify_references_query_graphify_query, _claude_skills_graphify_references_query_graphify_path, _claude_skills_graphify_references_query_graphify_explain, _claude_skills_graphify_references_exports_graphify_export, _claude_skills_graphify_references_hooks_graphify_hook, _claude_skills_graphify_references_hooks_graphify_claude, _claude_skills_graphify_references_github_and_merge_graphify_clone, _claude_skills_graphify_references_github_and_merge_graphify_merge_graphs, _claude_skills_graphify_references_query_graphify_reflect, _claude_skills_graphify_references_exports_graphify_serve, _claude_skills_graphify_references_exports_graphify_benchmark, _claude_skills_graphify_references_update_graphify_cluster_only, _claude_skills_graphify_references_add_watch_graphify_watch [INFERRED 0.95]
- **Graphify export targets** — _claude_skills_graphify_references_exports_neo4j_export, _claude_skills_graphify_references_exports_falkordb_export, _claude_skills_graphify_references_exports_wiki_export, _claude_skills_graphify_references_exports_svg_export, _claude_skills_graphify_references_exports_graphml_export, _claude_skills_graphify_references_exports_mcp_server [INFERRED 0.95]
- **Project constraints** — claude_no_any_constraint, claude_config_table_pricing, claude_create_route_handler_client, claude_data_cms_key [INFERRED 0.95]
- **Payment Flow Improvement System** — implementation_summary_decline_codes, implementation_summary_whatsapp_support, implementation_summary_receipt_email, root_cause_analysis_timeout_watchdog, root_cause_analysis_client_side_logging [INFERRED 0.85]
- **Door Lock Backend API System** — docs_door_lock_impl_summary_api_routes, docs_door_lock_impl_summary_scoped_totp, docs_door_lock_esp32_integration_qr_validation, docs_door_lock_esp32_integration_totp_password, docs_door_lock_impl_summary_admin_dashboard [INFERRED 0.85]
- **Hybrid CMS Content System** — docs_cms_architecture_hybrid_cms, docs_cms_architecture_static_base, docs_cms_architecture_db_override, docs_cms_architecture_cms_text, docs_cms_fix_summary_merge_messages [INFERRED 0.85]
- **User Registration and Profile Completion Flow** — docs_auth_payment_verification_sms_otp, docs_auth_payment_verification_apple_sign_in, docs_auth_payment_verification_login_fix, docs_auth_payment_verification_member_code_generation, docs_planet_reveal_planet_system_core, docs_planet_reveal_planet_reveal_component, docs_regression_fix_oauth_callback_check, docs_regression_fix_member_page_gate [INFERRED 0.85]

## Communities (237 total, 59 thin omitted)

### Community 0 - "createClient"
Cohesion: 0.07
Nodes (58): acceptInvite(), AcceptInvitePage(), InviteLookup, POST(), POST(), POST(), POST(), POST() (+50 more)

### Community 1 - "getMember.ts"
Cohesion: 0.17
Nodes (19): AdminBookingDetailPage(), getBookingDetail(), MemberBookingPage(), metadata, genId(), num(), str(), AdminBookingRow (+11 more)

### Community 2 - "config/route.ts"
Cohesion: 0.09
Nodes (37): BookingRulesValue, CONFIG_KEYS, ConfigKey, isFiniteNumber(), isRecord(), isTimeString(), PERIOD_DAYS, PERIOD_IDS (+29 more)

### Community 3 - "handler.js"
Cohesion: 0.08
Nodes (46): app, downloadChrome(), findChrome(), initWhatsApp(), executeAction(), executePendingAction(), handleAdminMessage(), parseAdminResponse() (+38 more)

### Community 4 - "book/page.tsx"
Cohesion: 0.06
Nodes (44): ALL_TABLES, BookPage(), Calendar(), CellState, cellStateFor(), CONFIG, ConfirmationTicket, ConfirmedBooking (+36 more)

### Community 5 - "MemberDashboard.tsx"
Cohesion: 0.05
Nodes (35): bookingEnd(), BookingsTab(), bookingStart(), calendarLink(), canRefund(), canReschedule(), canShowQr(), EASE (+27 more)

### Community 6 - "send.ts"
Cohesion: 0.12
Nodes (21): getResend(), sendAdminInviteEmail(), SendAdminInviteParams, sendBookingReceipt(), sendBookingRefundedEmail(), sendBookingRescheduledEmail(), SendReceiptParams, SendRefundedParams (+13 more)

### Community 7 - "devDependencies"
Cohesion: 0.05
Nodes (42): autoprefixer, devDependencies, autoprefixer, patch-package, postcss, sharp, tailwindcss, @types/leaflet (+34 more)

### Community 8 - "[slug]/page.tsx"
Cohesion: 0.08
Nodes (29): CATEGORIES, EASE, formatDate(), GRADIENTS, PostCard(), VIEWPORT, BlogPage(), BlogPostPage() (+21 more)

### Community 9 - "248 Snooker Club"
Cohesion: 0.06
Nodes (34): 248 Snooker Club, FalkorDB export, graphify export command, graphify serve MCP server, GraphML export, MCP server export, Neo4j export, SVG export (+26 more)

### Community 10 - "getAdminData"
Cohesion: 0.20
Nodes (12): GET(), isRecord(), LOCALES, POST(), TONES, GET(), GET(), isValidIp() (+4 more)

### Community 11 - "tokens.ts"
Cohesion: 0.11
Nodes (14): AdminBlogListPage(), getPosts(), AdminBookingsPage(), AdminDoorPage(), Tokens, LiveOccupancy(), ApiResponse, linkStyle (+6 more)

### Community 12 - "tools.ts"
Cohesion: 0.06
Nodes (47): AdminDashboardPage(), money(), ChatMessage, isRecord(), POST(), GET(), GET(), ASK_CHOICE_DEFINITION (+39 more)

### Community 13 - "createClient"
Cohesion: 0.23
Nodes (8): AccountMenu(), menuItemStyle, TIER_ACCENT, AppleSignInButton(), GoogleSignInButton(), AuthState, useAuthSession(), createClient()

### Community 14 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, supabase/functions, **/*.ts (+19 more)

### Community 15 - "whatsapp-bot/package.json"
Cohesion: 0.07
Nodes (26): dotenv, express, node-fetch, nodemon, puppeteer, qrcode-terminal, dependencies, dotenv (+18 more)

### Community 16 - "middleware.ts"
Cohesion: 0.14
Nodes (20): AI_USER_AGENTS, robots(), CacheEntry, getSiteGate(), SiteGateConfig, base64url(), hmacKey(), signGateCookie() (+12 more)

### Community 17 - "SiteGateLog.tsx"
Cohesion: 0.12
Nodes (18): AdminSiteGatePage(), errorMessage(), isRecord(), ToastState, errorMessage(), formatTime(), groupByIp(), IpGroup (+10 more)

### Community 18 - "Planet3D.tsx"
Cohesion: 0.21
Nodes (8): darkenColor(), generatePlanetTexture(), Planet3D(), PlanetSphere(), EASE, Phase, PLANET_METADATA, PlanetName

### Community 19 - "LegalContent.tsx"
Cohesion: 0.18
Nodes (12): BodyParagraphs(), EASE, LegalContent(), EN, getSortedPhrases(), highlightKeyPhrases(), PHRASES_BY_LOCALE, IMPORTANT: this file does not alter a single character of the verbatim (+4 more)

### Community 20 - "translate/route.ts"
Cohesion: 0.38
Nodes (6): isRecord(), Locale, LOCALES, POST(), slugify(), TRANSLATE_SCHEMA

### Community 21 - "Snooker404Table.tsx"
Cohesion: 0.17
Nodes (13): BallSpec, createBall(), createBallSpecs(), drawEightBallGlow(), drawEightBallLabel(), drawFeltTexture(), drawPocketRims(), homePositionFor() (+5 more)

### Community 22 - "StripePayment.tsx"
Cohesion: 0.14
Nodes (16): appearance, BillingDetails, BookingBlock, Labels, PayForm(), Props, STRIPE_LOCALES, StripePayment() (+8 more)

### Community 23 - "getServiceSupabase"
Cohesion: 0.22
Nodes (12): AdminBlogEditPage(), getPost(), getSiblings(), AdminTeamPage(), AdminUserRow, DELETE(), GET(), isRecord() (+4 more)

### Community 24 - "SettingsForm.tsx"
Cohesion: 0.15
Nodes (15): BookingRulesSection(), BookingRulesValue, ConfigKey, DiffRow, fieldRowStyle(), PricingSection(), PricingValue, SectionShell() (+7 more)

### Community 25 - "FAQ.tsx"
Cohesion: 0.22
Nodes (10): FaqPage(), META, EASE, FAQ(), VIEWPORT, FaqItem, getFaqItems(), getFaqJsonLd() (+2 more)

### Community 26 - "legal/index.ts"
Cohesion: 0.20
Nodes (12): REGISTRY, privacyEn, privacyZhCN, privacyZhHK, termsEn, termsZhCN, termsZhHK, LegalDocument (+4 more)

### Community 27 - "TicketCard.tsx"
Cohesion: 0.21
Nodes (13): DAY_NAMES, padTime(), TicketCard(), TicketCardProps, AppleLogo(), AppleLogoProps, AlipayLogo(), ApplePayLogo() (+5 more)

### Community 28 - "TeamTable.tsx"
Cohesion: 0.18
Nodes (12): Layout(), AdminSidebar(), NAV_ITEMS, NavItem, QuickActions(), statusColor(), TeamTable(), ToastState (+4 more)

### Community 29 - "humanReadableCode"
Cohesion: 0.18
Nodes (15): GET(), GET(), base64url(), checkChar(), humanReadableCode(), QrPayload, signQrToken(), DEFAULT_OPTIONS (+7 more)

### Community 30 - "ui/index.ts"
Cohesion: 0.15
Nodes (11): Props, SheetMode, TIERS, Input, InputProps, ProgressSteps(), ProgressStepsProps, Sheet() (+3 more)

### Community 31 - "getConfig"
Cohesion: 0.14
Nodes (16): AboutPage(), META, Home(), generateMetadata(), PricingPage(), META, VenuePage(), ContactButton() (+8 more)

### Community 32 - "Quick Deployment Guide — Payment Fixes"
Cohesion: 0.13
Nodes (14): 1. Install Dependencies, 2. Add Environment Variable, 3. Verify Resend Domain, 4. Update WhatsApp Number, After Deploy — Verify, Before Deploying, Check Logs, Database Migration (If Needed) (+6 more)

### Community 33 - "navigation.ts"
Cohesion: 0.21
Nodes (5): bebasNeue, metadata, viewport, { Link, redirect, usePathname, useRouter, getPathname }, routing

### Community 34 - "Button.tsx"
Cohesion: 0.13
Nodes (13): PostRow, BlogPost, LOCALES, SiblingPost, MemberBookingCalendar(), MemberBookingDay, monthLabel(), statusColor() (+5 more)

### Community 35 - "Nav.tsx"
Cohesion: 0.15
Nodes (11): AuthModal(), Logo(), HEADLINE_GRADIENT, FooterMap, EASE, Nav(), navItems, NavTheme (+3 more)

### Community 36 - "cms-sync.mjs"
Cohesion: 0.17
Nodes (8): APP_DIR, COMPONENTS_DIR, extracted, files, LOCALES, MESSAGES_DIR, report, ROOT

### Community 37 - "getAdminCalendar.ts"
Cohesion: 0.21
Nodes (14): AdminCalendarPage(), GET(), DayResponse, densityColor(), monthLabel(), MonthResponse, SlotCalendar(), timeToHourOffset() (+6 more)

### Community 38 - "HowItWorks.tsx"
Cohesion: 0.20
Nodes (8): EASE, highlight(), HowItWorks(), ICON_PROPS, ModalData, SPRING, Step, VIEWPORT

### Community 39 - "cms-seed-from-messages.mjs"
Cohesion: 0.36
Nodes (10): FAQ_KEYS, generateCmsContentInserts(), generateFaqListInserts(), generateLegalSectionInserts(), get(), loadMessages(), LOCALES, ROOT (+2 more)

### Community 40 - "Efficient Engineering"
Cohesion: 0.24
Nodes (10): Context Economy, Efficient Engineering, Model Choice, Session Hygiene, Verification Before Declaring Done, Goal-Driven Execution, Karpathy Guidelines, Simplicity First (+2 more)

### Community 41 - "Door Lock API Routes"
Cohesion: 0.20
Nodes (10): ESP32 Door Lock Device, QR Code Validation API, Door Lock Admin Dashboard, Door Lock API Routes, Offline Cache Resilience, Booking Confirmation Email Template, Unified QR Code Generation System, Stripe Decline Code Mapping (+2 more)

### Community 42 - "dependencies"
Cohesion: 0.22
Nodes (9): @anthropic-ai/sdk, canvas-confetti, matter-js, dependencies, @anthropic-ai/sdk, canvas-confetti, matter-js, @tiptap/starter-kit (+1 more)

### Community 43 - "AiSettingsForm.tsx"
Cohesion: 0.28
Nodes (7): AdminAiSettingsPage(), getInitialSettings(), AiSettingsForm(), emptyRow(), LOCALES, SettingsRow, TONES

### Community 44 - "AboutContent.tsx"
Cohesion: 0.09
Nodes (14): AboutContent(), ClockIcon2(), EASE, FACILITY_ICONS, PhoneIcon2(), POP, SPRING, StatsItem (+6 more)

### Community 45 - "Apple UI Design Skill"
Cohesion: 0.14
Nodes (13): Anti-patterns (never do), Apple Card Pattern, Apple UI Design Skill, Component Checklist, Copy Rules, Design Tokens, + Expand Button (Apple Proportion Rule), FLUENT Principle (+5 more)

### Community 46 - "Apple UI Design"
Cohesion: 0.25
Nodes (9): Anti-patterns, Apple Card Pattern, Apple UI Design, Component Checklist, Design Tokens, FLUENT Principle, Section Rhythm, Typography Hierarchy (+1 more)

### Community 47 - "Security & Backend"
Cohesion: 0.22
Nodes (9): QR Code Generation, Commit Types, Deploy, Git Workflow, Auth Architecture, Environment Variables, QR Code Spec, Security & Backend (+1 more)

### Community 48 - "seed-cms-from-messages.mjs"
Cohesion: 0.31
Nodes (8): flatten(), inferPageFromKey(), LOCALES, main(), MESSAGES_DIR, ROOT, seedLocale(), supabase

### Community 49 - "Web Application Testing"
Cohesion: 0.25
Nodes (8): Decision Tree, Playwright, Reconnaissance-Then-Action Pattern, Web Application Testing, with_server.py, File Structure, Next.js 14 App Router Patterns, Server vs Client

### Community 50 - "profile.ts"
Cohesion: 0.22
Nodes (13): POST(), NOTE: this write can only 500 — auth is fully settled above, so a 401 can, POST(), localHkPhoneValue(), ProfileCompletion(), NOTE: this is intentionally NOT tokens.colors.brand (#25D366, WhatsApp, NamePhoneValidation, normalizeHkPhone() (+5 more)

### Community 51 - "Member.tsx"
Cohesion: 0.10
Nodes (13): EASE, VIEWPORT, EASE, highlight(), ICON_PROPS, Member(), ModalData, SPRING (+5 more)

### Community 52 - "Booking Flow"
Cohesion: 0.25
Nodes (8): Booking Flow, Endowed Progress Effect, Member Tiers, Peak-End Rule, Pricing Logic, Slot Locking, Stripe Flow, API Security

### Community 53 - "Gallery.tsx"
Cohesion: 0.25
Nodes (6): DOT_SPRING, EASE, TODO: 需要 Luca 提供正確素材 — 中式桌球枱場地照片（暫用現有圖佔位）, slideImages, SlideText, VIEWPORT

### Community 54 - "cms-audit.mjs"
Cohesion: 0.25
Nodes (5): APP_DIR, COMPONENTS_DIR, files, offenders, ROOT

### Community 55 - "Supabase Email Templates README"
Cohesion: 0.36
Nodes (8): Change Email Confirmation (HTML), Confirm Signup (HTML), Email Changed Notification (HTML), User Invitation (HTML), Magic Link / OTP (HTML), Phone Changed Notification (HTML), Supabase Email Templates README, Reauthentication (HTML)

### Community 56 - "planetSystem.ts"
Cohesion: 0.31
Nodes (7): extractPlanetFromCode(), generateMemberCode(), memberCheckChar(), MemberTier, PLANET_POOL, PlanetMeta, tierAbbr()

### Community 57 - "VenueContent.tsx"
Cohesion: 0.22
Nodes (7): EASE, FACILITY_ICON_CLASSES, FACILITY_ICONS, SERVICE_ICON_CLASSES, SERVICE_ICONS, TitledItem, VIEWPORT

### Community 58 - "Graphify"
Cohesion: 0.29
Nodes (7): AST Extraction, Community Detection, God Nodes, Graphify, Honesty Rules, Knowledge Graph, Semantic Extraction

### Community 59 - "248 Snooker Club"
Cohesion: 0.15
Nodes (12): 1. Install dependencies, 248 Snooker Club, 2. Environment variables, 3. Database setup, 4. Stripe webhook (local dev), 5. Run the dev server, 6. CMS text sync, 7. Testing (+4 more)

### Community 60 - "service.ts"
Cohesion: 0.16
Nodes (11): ALLOWED_TYPES, POST(), isRecord(), PATCH(), POST(), RequestRow, isRecord(), POST() (+3 more)

### Community 61 - "member/page.tsx"
Cohesion: 0.25
Nodes (11): AdminSettingsPage(), ComingSoonPage(), metadata, LoginPage(), metadata, safeReturnUrl(), MemberPage(), metadata (+3 more)

### Community 62 - "getAdminMembers.ts"
Cohesion: 0.20
Nodes (9): isRecord(), PATCH(), VALID_TIERS, Row, AdminDoorCardsResult, DoorCardRow, AdminMemberRow, AdminMembersQuery (+1 more)

### Community 63 - "i18n-locale-audit.mjs"
Cohesion: 0.29
Nodes (5): allKeys, __dirname, keysByLocale, LOCALES, missing

### Community 64 - "legal/page.tsx"
Cohesion: 0.36
Nodes (7): DOC_IDS, generateMetadata(), LegalPage(), resolveDocId(), getAllLegalDocuments(), getLegalDocument(), LegalDocId

### Community 65 - "ComingSoonContent.tsx"
Cohesion: 0.15
Nodes (8): LogoProps, NOTE: there is no black-on-transparent "mark only" export in the current, AmbientGlow(), AmbientGlowVariant, BRAND_EDGES, EdgeGlow, GEMINI_EDGES, useReducedMotion()

### Community 66 - "248 Booking Flow Skill"
Cohesion: 0.18
Nodes (10): 248 Booking Flow Skill, API Routes (app/api), Member Tiers, Pricing Logic (server-side only), QR Code Generation, Session Storage Schema, Slot Locking, Stripe Flow (+2 more)

### Community 67 - "site-gate/route.ts"
Cohesion: 0.31
Nodes (8): Body, GET(), isBody(), POST(), POST(), hashGatePassword(), scrypt(), verifyGatePassword()

### Community 68 - "convert-logo-for-email.js"
Cohesion: 0.33
Nodes (4): fs, path, PNG_PATH, SVG_PATH

### Community 69 - "merge-messages.mjs"
Cohesion: 0.33
Nodes (4): data, __dirname, LOCALES, MESSAGES_DIR

### Community 70 - "build_merge function"
Cohesion: 0.50
Nodes (5): build_merge function, detect_incremental function, graph_diff function, Incremental update pipeline, save_manifest function

### Community 71 - "door-lock/page.tsx"
Cohesion: 0.33
Nodes (4): AccessLog, DeviceStatus, LockoutStatus, RelayStatus

### Community 72 - "AdminAIPanel.tsx"
Cohesion: 0.60
Nodes (4): AdminAIPanel(), ChatMessage, renderInline(), renderReply()

### Community 73 - "blog/route.ts"
Cohesion: 0.47
Nodes (5): GET(), isRecord(), LOCALES, POST(), slugify()

### Community 74 - "Hybrid CMS Architecture"
Cohesion: 0.40
Nodes (5): CMSText Component, CMS Content Database Override Layer, Hybrid CMS Architecture, Static JSON Message Files, mergeMessages Function

### Community 75 - "count_sections"
Cohesion: 0.50
Nodes (4): Path, count_sections(), main(), Count top-level `{ title: ..., body: ... }` entries in the `sections:` array of…

### Community 76 - "backfill-human-codes.mjs"
Cohesion: 0.60
Nodes (4): checkChar(), humanReadableCode(), main(), supabase

### Community 77 - "is_server_ready"
Cohesion: 0.67
Nodes (3): is_server_ready(), main(), Wait for server to be ready by polling the port.

### Community 78 - "bookings/route.ts"
Cohesion: 0.60
Nodes (4): GET(), isRecord(), PATCH(), getAdminBookings()

### Community 79 - "backup-password/route.ts"
Cohesion: 0.67
Nodes (3): generatePassword(), POST(), supabase

### Community 80 - "validate-password/route.ts"
Cohesion: 0.67
Nodes (3): generatePassword(), POST(), supabase

### Community 81 - "validate-qr/route.ts"
Cohesion: 0.67
Nodes (3): logAccess(), POST(), supabase

### Community 83 - "AuthCard.tsx"
Cohesion: 0.23
Nodes (9): errorKey(), LoginForm(), safeReturnUrl(), AuthCard(), EASE, OtpChannel, Phase, Prefill (+1 more)

### Community 84 - "PlanetReveal Canvas Component"
Cohesion: 0.50
Nodes (4): generate_member_code Database Function, Canvas 2D Renderer for Planet Reveal, PlanetReveal Canvas Component, Planet System Core

### Community 85 - "next.config.js"
Cohesion: 0.50
Nodes (3): createNextIntlPlugin, nextConfig, withNextIntl

### Community 86 - "PR Review command"
Cohesion: 1.00
Nodes (3): PR Review command, Test and Fix command, Verify Fix command

### Community 87 - "URL ingestion pipeline"
Cohesion: 0.67
Nodes (3): ingest function, URL ingestion pipeline, yt-dlp

### Community 88 - "Cross-repo merge pipeline"
Cohesion: 0.67
Nodes (3): Cross-repo merge pipeline, graphify clone command, graphify merge-graphs command

### Community 89 - "Video transcription pipeline"
Cohesion: 0.67
Nodes (3): transcribe_all function, Video transcription pipeline, Whisper transcription model

### Community 96 - "kebab-case naming"
Cohesion: 0.67
Nodes (3): kebab-case naming, PascalCase naming, use prefix hooks

### Community 97 - "Login Page Crash Fix"
Cohesion: 0.67
Nodes (3): Apple Sign-In Fix, Login Page Crash Fix, SMS OTP Auth Fix

### Community 98 - "Client-Side Payment Logging"
Cohesion: 0.67
Nodes (3): Structured Booking and Payment Logging, Client-Side Payment Logging, Payment Timeout Watchdog

### Community 99 - "Supabase Auth Email Templates"
Cohesion: 0.67
Nodes (3): SVG to PNG Logo Conversion Script, Supabase Auth Email Templates, Email Template Design System

### Community 100 - "cards/[id]/route.ts"
Cohesion: 0.50
Nodes (4): CardRow, DELETE(), isRecord(), PATCH()

### Community 136 - "animations.ts"
Cohesion: 0.40
Nodes (4): EASE, POP, POP_SUBTLE, VIEWPORT

### Community 137 - "BookingTable.tsx"
Cohesion: 0.50
Nodes (4): ApiResponse, BookingTable(), STATUS_OPTIONS, statusColor()

### Community 215 - "getAdminMembers"
Cohesion: 0.67
Nodes (3): AdminMembersPage(), GET(), getAdminMembers()

### Community 216 - "generate-image/route.ts"
Cohesion: 0.83
Nodes (3): isRecord(), POST(), generateImage()

### Community 217 - "confirm/route.ts"
Cohesion: 0.67
Nodes (3): isRecord(), POST(), RequestRow

### Community 221 - "Security & Backend Skill"
Cohesion: 0.22
Nodes (8): API Route Template, API Security, Auth Architecture, Environment Variables (never hardcode), QR Code Spec, Security & Backend Skill, Supabase Project, Supabase Rules

### Community 223 - "Installation Required"
Cohesion: 0.25
Nodes (7): 1. Install dependencies, 2. Environment variables, 3. Verify domain in Resend, 4. Update WhatsApp number, 5. Test in development, 6. Database migration check, Installation Required

### Community 224 - "Next.js 14 App Router Patterns"
Cohesion: 0.29
Nodes (6): CMS Pattern, File Structure (repo root — NO src/ dir), Metadata (every page), Next.js 14 App Router Patterns, Performance, Server vs Client

### Community 225 - "AGENTS.md"
Cohesion: 0.33
Nodes (4): Constraints, Naming, Stack, Working style

### Community 226 - "Efficient Engineering"
Cohesion: 0.33
Nodes (5): Context economy, Efficient Engineering, Model choice, Session hygiene, Verification before declaring done

### Community 227 - "Git Workflow Skill"
Cohesion: 0.33
Nodes (5): After Every Task, Commit Types, Deploy, Git Workflow Skill, Rules

### Community 228 - "Karpathy Guidelines"
Cohesion: 0.33
Nodes (5): 1. Think Before Coding, 2. Simplicity First, 3. Surgical Changes, 4. Goal-Driven Execution, Karpathy Guidelines

### Community 229 - "useNfcRegistrationStatus.ts"
Cohesion: 0.40
Nodes (5): DoorCardTable(), isRegistrationStatus(), NfcRegistrationStatus, RegistrationState, useNfcRegistrationStatus()

### Community 230 - "[locale]/page.tsx"
Cohesion: 0.17
Nodes (7): Directions(), HOMEPAGE_FAQ_IDS, GalleryScroll(), TODO: 需要 Luca 提供正確素材 — 掃碼即入場、私人獨立空間、頂級燈光設備的專用照片, slideImages, fmt(), HomePricing()

### Community 234 - "team/[id]/route.ts"
Cohesion: 0.67
Nodes (3): isRecord(), PATCH(), TargetRow

## Knowledge Gaps
- **601 isolated node(s):** `Snooker404TableProps`, `TableSize`, `BallSpec`, `EASE`, `SPRING` (+596 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getServiceSupabase()` connect `getServiceSupabase` to `createClient`, `getMember.ts`, `config/route.ts`, `getAdminData`, `tokens.ts`, `tools.ts`, `middleware.ts`, `SiteGateLog.tsx`, `translate/route.ts`, `humanReadableCode`, `getAdminCalendar.ts`, `AiSettingsForm.tsx`, `profile.ts`, `service.ts`, `getAdminMembers.ts`, `site-gate/route.ts`, `blog/route.ts`, `bookings/route.ts`, `getAdminMembers`, `generate-image/route.ts`, `confirm/route.ts`, `cards/[id]/route.ts`, `team/[id]/route.ts`, `register-request/route.ts`, `access-log/route.ts`, `members/[id]/page.tsx`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `framer-motion`, `leaflet`, `devDependencies`, `next`, `next-intl`, `react`, `react-dom`, `@react-email/render`, `react-leaflet`, `@react-three/fiber`, `recharts`, `remotion`, `@remotion/cli`, `@remotion/player`, `stripe`, `@stripe/react-stripe-js`, `@stripe/stripe-js`, `@supabase/ssr`, `@supabase/supabase-js`, `three`, `@tiptap/react`, `qrcode`, `@types/canvas-confetti`, `@ybouane/liquidglass`, `resend`, `lucide-react`, `@tiptap/extension-image`, `@tiptap/extension-link`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `generateQR()` connect `humanReadableCode` to `qrcode`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **What connects `Snooker404TableProps`, `TableSize`, `BallSpec` to the rest of the system?**
  _601 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `createClient` be split into smaller, more focused modules?**
  _Cohesion score 0.07160493827160494 - nodes in this community are weakly interconnected._
- **Should `config/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09065679925994449 - nodes in this community are weakly interconnected._
- **Should `handler.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08395989974937343 - nodes in this community are weakly interconnected._