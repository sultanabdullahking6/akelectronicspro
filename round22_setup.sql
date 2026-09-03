-- =========================================================
-- AK ELECTRONICS PRO — ROUND 22: FIX MISPLACED VIDEO AD
-- Run this in Supabase SQL Editor.
-- Any video ad that was uploaded before the 3-zone Ads system
-- existed defaulted to placement='mid' — this moves it to
-- 'splash' so it correctly plays as the front-of-site video ad.
-- =========================================================

update public.ads
set placement = 'splash'
where media_type = 'video' and placement != 'splash';

-- Confirm the fix — should show placement = 'splash' for any video row:
select id, media_type, placement, active from public.ads where media_type = 'video';

-- =========================================================
-- DONE.
-- =========================================================
