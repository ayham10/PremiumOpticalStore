-- LUMINA media bucket
insert into storage.buckets (id, name, public)
values ('lumina-media', 'lumina-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read lumina media" on storage.objects;
create policy "Public read lumina media"
on storage.objects for select
to public
using (bucket_id = 'lumina-media');

-- Service role (server API) bypasses RLS for uploads/deletes.
