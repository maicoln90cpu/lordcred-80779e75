SELECT cron.schedule(
  'v8-scheduled-launcher-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sibfqmzsnftscnlyuwiu.supabase.co/functions/v1/v8-scheduled-launcher',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYmZxbXpzbmZ0c2NubHl1d2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg0NTAsImV4cCI6MjA4NzE3NDQ1MH0.kzRxoVKtKopnL_OD3TQMlXfCfbJCd6jYhx-IyU7Q67U"}'::jsonb,
    body := '{"trigger":"pg_cron"}'::jsonb
  ) AS request_id;
  $$
);