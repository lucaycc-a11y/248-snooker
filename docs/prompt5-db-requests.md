# Database changes needed (Prompt 5 - Section I)

## Non-member area schema drift

### Admin AI settings (app/admin/ai-settings/page.tsx)
- Missing table: ai_widget_settings
- Columns needed: locale, greeting_message, suggested_prompts, system_prompt_override, tone
- Used by: AI widget configuration page (admin-only)


### Blog posts translations (app/admin/blog/[id]/page.tsx)
- Missing column: blog_posts.translation_group_id
- Used by: Blog post translation management (admin-only)
