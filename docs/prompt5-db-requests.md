# Database changes needed (Prompt 5 - Section I)

## Non-member area schema drift

### Admin AI settings (app/api/admin/ai-settings/route.ts)
- Missing table: ai_widget_settings
- Columns needed: id (uuid, pk), locale (text), greeting_message (text), suggested_prompts (text[]), system_prompt_override (text, nullable), tone (text), updated_at (timestamp), updated_by (uuid)
- Used by: Admin API for AI widget configuration (admin-only)
- Current workaround: Route returns empty array until table exists

### Admin blog translation (app/api/admin/blog/route.ts, app/api/admin/blog/translate/route.ts)
- Missing column: blog_posts.translation_group_id
- Type: uuid, nullable
- Used by: Admin blog content translation grouping
- Current workaround: Translation route fails until column exists
- Impact: Blocks npm run build

### Admin user management (admin entry point)
- Schema issue: users.is_admin column does not exist
- Required table: admin_users with columns: id (uuid, pk), user_id (uuid, fk users), email (text), tier ('admin' | 'super_admin'), created_at (timestamp), updated_at (timestamp)
- Used by: Admin authentication and role-based access control
- Current workaround: Redirect unauthenticated admins to login

### Admin action log (app/api/admin/audit/route.ts)
- Missing table: admin_action_log
- Columns needed: id (uuid, pk), admin_user_id (uuid, fk admin_users), admin_email (text), action_type (text), target_table (text), target_id (text), before_value (jsonb), after_value (jsonb), risk_level (text), created_at (timestamp)
- Used by: Admin member account audit history and compliance tracking
- Current workaround: Audit route fails until table exists
- Impact: Blocks npm run build


