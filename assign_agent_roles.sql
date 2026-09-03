-- =========================================================
-- AK ELECTRONICS PRO — ASSIGN AGENT ROLES
-- Run this AFTER creating both agent accounts in
-- Authentication > Users (Add user) with their email/password.
-- This SQL tags each account with its role so the Admin Panel
-- knows which tab to restrict them to.
-- =========================================================

update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"role":"products_agent"}'::jsonb
where email = 'productagent@gmail.com';

update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"role":"projects_agent"}'::jsonb
where email = 'projectagent@gmail.com';

-- Confirm it worked — should show both emails with their role in the result:
select email, raw_user_meta_data
from auth.users
where email in ('productagent@gmail.com', 'projectagent@gmail.com');

-- =========================================================
-- DONE.
-- =========================================================
