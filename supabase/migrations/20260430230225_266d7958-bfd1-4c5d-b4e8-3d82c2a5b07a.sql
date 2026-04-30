
-- Schedule auto-close every 15 minutes (pg_cron already enabled)
SELECT cron.schedule(
  'auto-close-meta-conversations-24h',
  '*/15 * * * *',
  $$SELECT public.auto_close_inactive_meta_conversations()$$
);
