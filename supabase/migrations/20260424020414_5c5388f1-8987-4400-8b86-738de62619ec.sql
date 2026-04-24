-- Remove previous job with same name (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('hr-notifications-sender');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule every 5 minutes
SELECT cron.schedule(
  'hr-notifications-sender',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sibfqmzsnftscnlyuwiu.supabase.co/functions/v1/hr-notification-sender',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYmZxbXpzbmZ0c2NubHl1d2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg0NTAsImV4cCI6MjA4NzE3NDQ1MH0.kzRxoVKtKopnL_OD3TQMlXfCfbJCd6jYhx-IyU7Q67U"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);