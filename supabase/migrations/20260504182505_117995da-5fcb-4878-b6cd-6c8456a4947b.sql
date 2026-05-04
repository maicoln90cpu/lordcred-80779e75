insert into storage.buckets (id, name, public) values ('whatsapp-media-cache','whatsapp-media-cache', true) on conflict (id) do nothing;

create policy "whatsapp-media-cache read" on storage.objects for select using (bucket_id = 'whatsapp-media-cache');
create policy "whatsapp-media-cache write service" on storage.objects for insert with check (bucket_id = 'whatsapp-media-cache');