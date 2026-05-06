-- v8-webhook replay frequente (a cada 5 min, batch menor) — complementa o cron diário
SELECT cron.schedule(
  'v8-webhook-replay-pending-frequent',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sibfqmzsnftscnlyuwiu.supabase.co/functions/v1/v8-webhook',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYmZxbXpzbmZ0c2NubHl1d2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg0NTAsImV4cCI6MjA4NzE3NDQ1MH0.kzRxoVKtKopnL_OD3TQMlXfCfbJCd6jYhx-IyU7Q67U"}'::jsonb,
    body := '{"action":"replay_pending","limit":100}'::jsonb
  );
  $$
);