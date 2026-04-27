UPDATE public.v8_simulations
SET 
  status = 'failed',
  error_message = COALESCE(
    NULLIF(error_message, ''),
    'Status corrigido automaticamente: simulação foi marcada como sucesso pelo webhook V8 mas não retornou valores monetários (released_value/installment_value). Geralmente causado por rate limit ou erro intermediário na V8.'
  ),
  last_step = COALESCE(last_step, 'auto_correction')
WHERE status = 'success'
  AND (released_value IS NULL OR installment_value IS NULL);