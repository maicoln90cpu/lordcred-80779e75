UPDATE public.v8_webhook_logs w
SET cpf = regexp_replace(s.cpf, '\D', '', 'g')
FROM public.v8_simulations s
WHERE w.cpf IS NULL
  AND s.consult_id = w.consult_id
  AND s.consult_id IS NOT NULL
  AND length(regexp_replace(COALESCE(s.cpf,''), '\D', '', 'g')) = 11;