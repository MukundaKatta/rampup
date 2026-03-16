-- RampUp Storage Buckets and Cron Jobs

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('documents', 'documents', false, 52428800, -- 50MB
     array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
           'text/plain', 'text/markdown', 'application/vnd.ms-powerpoint',
           'application/vnd.openxmlformats-officedocument.presentationml.presentation']),
    ('avatars', 'avatars', true, 5242880, -- 5MB
     array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('logos', 'logos', true, 5242880,
     array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);

-- Storage policies
create policy "Org members can view documents"
    on storage.objects for select
    using (bucket_id = 'documents' and (
        select organization_id from users where id = auth.uid()
    ) = (storage.foldername(name))[1]::uuid);

create policy "Admins can upload documents"
    on storage.objects for insert
    with check (bucket_id = 'documents' and (
        select role from users where id = auth.uid()
    ) in ('owner', 'admin', 'manager'));

create policy "Anyone can view avatars"
    on storage.objects for select
    using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
    on storage.objects for insert
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Anyone can view logos"
    on storage.objects for select
    using (bucket_id = 'logos');

-- ============================================================
-- CRON JOBS (requires pg_cron extension)
-- ============================================================

-- Mark overdue tasks every day at midnight
select cron.schedule(
    'mark-overdue-tasks',
    '0 0 * * *',
    $$select mark_overdue_tasks()$$
);

-- Record daily metrics at 11pm
select cron.schedule(
    'record-daily-metrics',
    '0 23 * * *',
    $$select record_daily_metrics()$$
);
