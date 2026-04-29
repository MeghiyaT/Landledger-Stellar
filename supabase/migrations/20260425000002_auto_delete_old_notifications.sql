-- ============================================================
-- Auto-delete notifications older than 15 days
-- ============================================================

-- 1. Enable pg_cron extension (run once)
create extension if not exists pg_cron;

-- 2. Schedule daily cleanup at 2:00 AM UTC
select cron.schedule(
  'delete-old-notifications',        -- job name (unique)
  '0 2 * * *',                       -- cron expression: 2am every day
  $$
    delete from notifications
    where created_at < now() - interval '15 days';
  $$
);
