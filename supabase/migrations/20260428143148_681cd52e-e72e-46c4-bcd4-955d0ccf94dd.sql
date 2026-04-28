-- Agenda v8-orphan-reconciler para rodar a cada 2 minutos.
-- Cruza webhooks órfãos (sem simulation_id local) com simulações pending por CPF
-- e promove os dados quando há match. Recupera ~11k webhooks órfãos legados.
SELECT cron.schedule(
  'v8-orphan-reconciler-every-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sibfqmzsnftscnlyuwiu.supabase.co/functions/v1/v8-orphan-reconciler',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYmZxbXpzbmZ0c2NubHl1d2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg0NTAsImV4cCI6MjA4NzE3NDQ1MH0.kzRxoVKtKopnL_OD3TQMlXfCfbJCd6jYhx-IyU7Q67U"}'::jsonb,
    body := jsonb_build_object('triggered_by', 'pg_cron', 'time', now())
  ) AS request_id;
  $$
);