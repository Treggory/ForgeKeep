-- =============================================================================
-- Migration 0004: Supabase Storage bucket for photos
-- =============================================================================
-- Files are stored under a per-user folder: <auth.uid()>/<entity>/<file>.
-- The storage policies below ensure a user can only touch objects inside their
-- own top-level folder, matching the table-level RLS.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('inventory-photos', 'inventory-photos', false)
on conflict (id) do nothing;

drop policy if exists "photos read own"   on storage.objects;
drop policy if exists "photos insert own" on storage.objects;
drop policy if exists "photos update own" on storage.objects;
drop policy if exists "photos delete own" on storage.objects;

create policy "photos read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'inventory-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inventory-photos'
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'inventory-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'inventory-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);
