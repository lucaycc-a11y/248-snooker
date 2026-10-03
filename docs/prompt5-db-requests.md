# Database changes needed (Prompt 5 - Section I)

## Non-member area schema drift

### Admin AI settings (app/api/admin/ai-settings/route.ts)
- Missing table: ai_widget_settings
- Columns needed: id (uuid, pk), locale (text), greeting_message (text), suggested_prompts (text[]), system_prompt_override (text, nullable), tone (text), updated_at (timestamp), updated_by (uuid)
- Used by: Admin API for AI widget configuration (admin-only)
- Current workaround: Route returns empty array until table exists


### Blog posts translations (app/admin/blog/[id]/page.tsx)
- Missing column: blog_posts.translation_group_id
- Used by: Blog post translation management (admin-only)

### Admin action log (app/admin/members/[id]/page.tsx)
- Missing table: admin_action_log
- Columns needed: id, action_type, before_jsonb, after_jsonb, created_at, user_id
- Used by: Admin member account audit history

