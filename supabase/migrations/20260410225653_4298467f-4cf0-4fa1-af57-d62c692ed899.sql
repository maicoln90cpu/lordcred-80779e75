-- Remove duplicate Banco C6 records (keep the original 2026-04-07 insert, delete the 2026-04-10 duplicates)
DELETE FROM commission_rates_clt 
WHERE bank = 'Banco C6' 
  AND effective_date = '2026-04-07' 
  AND created_at::date = '2026-04-10';