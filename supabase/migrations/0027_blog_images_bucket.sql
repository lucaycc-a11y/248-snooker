-- Public-read Supabase Storage bucket for blog cover/inline images (manual
-- admin uploads and AI-generated). Path convention: {postId}/{uuid}-{filename}.
-- Same public-read / service-role-write RLS split as cms_content and
-- ai_widget_settings (0026) — not a new access pattern.

insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

drop policy if exists "blog_images_public_read" on storage.objects;
create policy "blog_images_public_read"
  on storage.objects for select
  using (bucket_id = 'blog-images');

drop policy if exists "blog_images_service_role_write" on storage.objects;
create policy "blog_images_service_role_write"
  on storage.objects for all
  using (bucket_id = 'blog-images' and auth.role() = 'service_role')
  with check (bucket_id = 'blog-images' and auth.role() = 'service_role');
