-- CHECK.md item 4: RLS was disabled on documents/chunks. Not exploitable today
-- (no anon/publishable key exists anywhere in the codebase; the app only uses
-- service_role, which bypasses RLS regardless), but latent: the moment an
-- anon key is generated or leaked, anyone holding it could read or delete
-- every document directly via Supabase's REST API. No policies are added
-- since only service_role ever needs access.

alter table documents enable row level security;
alter table chunks enable row level security;
