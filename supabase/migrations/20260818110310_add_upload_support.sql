-- PLAN.md task 3: the upload route stores the file before extraction (task 5) has
-- run, so extractable_status needs a 'pending' state between upload and extraction.
alter table documents drop constraint documents_extractable_status_check;
alter table documents add constraint documents_extractable_status_check
  check (extractable_status in ('pending', 'full', 'partial', 'unsupported'));
alter table documents alter column extractable_status set default 'pending';

-- Private bucket for original PDF files (DESIGN.md "Supabase Storage" row).
-- No public/anon access; the app only ever talks to Storage via the server-side
-- service_role client, which bypasses RLS, so no bucket policies are needed here.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
