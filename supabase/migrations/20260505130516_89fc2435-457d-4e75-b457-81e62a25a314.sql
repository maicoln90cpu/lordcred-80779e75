
INSERT INTO corban_notifications (user_id, proposta_id, tipo, mensagem)
SELECT
  csm.user_id,
  s.proposta_id,
  CASE WHEN corban_classify_status(s.status) = 'pago' THEN 'proposta_paga' ELSE 'proposta_aprovada' END,
  CASE WHEN corban_classify_status(s.status) = 'pago' THEN '💰' ELSE '✅' END
    || ' Proposta ' || COALESCE(s.proposta_id, '')
    || ' (' || COALESCE(s.nome, 'sem nome') || ') — '
    || CASE WHEN corban_classify_status(s.status) = 'pago' THEN 'PAGA' ELSE 'APROVADA' END
    || COALESCE(' [' || s.banco || ']', '')
FROM corban_propostas_snapshot s
JOIN corban_seller_mapping csm ON csm.corban_name = s.vendedor_nome AND csm.user_id IS NOT NULL
WHERE corban_classify_status(s.status) IS NOT NULL
  AND COALESCE(s.updated_at, s.snapshot_date::timestamptz) > now() - interval '30 days'
  AND NOT EXISTS (
    SELECT 1 FROM corban_notifications n
    WHERE n.proposta_id = s.proposta_id
      AND n.tipo = CASE WHEN corban_classify_status(s.status) = 'pago' THEN 'proposta_paga' ELSE 'proposta_aprovada' END
  );
