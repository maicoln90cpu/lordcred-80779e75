-- ============================================================================
-- ENTREGA A: Sino de notificações Corban — trigger + backfill
-- ============================================================================

-- 1) Função classificadora: retorna 'aprovado', 'pago' ou NULL
CREATE OR REPLACE FUNCTION public.corban_classify_status(_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _status IS NULL OR _status = '' THEN NULL
    -- PAGO tem prioridade (é estado mais avançado)
    WHEN UPPER(_status) LIKE '%PAGO%'
      OR UPPER(_status) LIKE '%PAGAMENTO%CONFIRM%'
      OR UPPER(_status) = 'PAGAMENTOCONFIRMADO'
      THEN 'pago'
    WHEN UPPER(_status) LIKE 'APROVAD%'
      OR UPPER(_status) LIKE '%INTEGRAD%'
      OR UPPER(_status) LIKE 'CADASTRADACOMSUCESSO'
      THEN 'aprovado'
    ELSE NULL
  END
$$;

-- 2) Trigger: notifica quando entra em estado terminal aprovado/pago
CREATE OR REPLACE FUNCTION public.notify_corban_terminal_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old_class text;
  _new_class text;
  _seller_user_id uuid;
  _msg text;
  _tipo text;
  _emoji text;
BEGIN
  _old_class := corban_classify_status(COALESCE(OLD.status, ''));
  _new_class := corban_classify_status(COALESCE(NEW.status, ''));

  -- Só age se houve transição relevante para estado terminal
  IF _new_class IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se já estava no mesmo estado terminal, não duplica
  IF _old_class IS NOT DISTINCT FROM _new_class THEN
    RETURN NEW;
  END IF;

  -- Resolve vendedor
  IF NEW.vendedor_nome IS NULL OR NEW.vendedor_nome = '' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO _seller_user_id
  FROM corban_seller_mapping
  WHERE corban_name = NEW.vendedor_nome AND user_id IS NOT NULL
  LIMIT 1;

  IF _seller_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF _new_class = 'pago' THEN
    _tipo := 'proposta_paga';
    _emoji := '💰';
  ELSE
    _tipo := 'proposta_aprovada';
    _emoji := '✅';
  END IF;

  _msg := _emoji || ' Proposta ' || COALESCE(NEW.proposta_id, '') ||
          ' (' || COALESCE(NEW.nome, 'sem nome') || ') — ' ||
          CASE WHEN _new_class = 'pago' THEN 'PAGA' ELSE 'APROVADA' END ||
          COALESCE(' [' || NEW.banco || ']', '');

  INSERT INTO corban_notifications (user_id, proposta_id, tipo, mensagem)
  VALUES (_seller_user_id, NEW.proposta_id, _tipo, _msg);

  RETURN NEW;
END;
$$;

-- 3) Cria os triggers (UPDATE e INSERT — pega tanto mudança quanto primeira aparição já aprovada)
DROP TRIGGER IF EXISTS trg_notify_corban_terminal_update ON corban_propostas_snapshot;
CREATE TRIGGER trg_notify_corban_terminal_update
  AFTER UPDATE OF status ON corban_propostas_snapshot
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_corban_terminal_status();

DROP TRIGGER IF EXISTS trg_notify_corban_terminal_insert ON corban_propostas_snapshot;
CREATE TRIGGER trg_notify_corban_terminal_insert
  AFTER INSERT ON corban_propostas_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION notify_corban_terminal_status();

-- 4) BACKFILL: gera notificações dos últimos 7 dias
-- Evita duplicar: não cria se já existir notificação do mesmo tipo para a mesma proposta_id
INSERT INTO corban_notifications (user_id, proposta_id, tipo, mensagem)
SELECT
  csm.user_id,
  s.proposta_id,
  CASE WHEN corban_classify_status(s.status) = 'pago' THEN 'proposta_paga' ELSE 'proposta_aprovada' END AS tipo,
  CASE WHEN corban_classify_status(s.status) = 'pago' THEN '💰' ELSE '✅' END
    || ' Proposta ' || COALESCE(s.proposta_id, '')
    || ' (' || COALESCE(s.nome, 'sem nome') || ') — '
    || CASE WHEN corban_classify_status(s.status) = 'pago' THEN 'PAGA' ELSE 'APROVADA' END
    || COALESCE(' [' || s.banco || ']', '') AS mensagem
FROM corban_propostas_snapshot s
JOIN corban_seller_mapping csm
  ON csm.corban_name = s.vendedor_nome
  AND csm.user_id IS NOT NULL
WHERE corban_classify_status(s.status) IS NOT NULL
  AND s.updated_at >= now() - interval '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM corban_notifications n
    WHERE n.user_id = csm.user_id
      AND n.proposta_id = s.proposta_id
      AND n.tipo = CASE WHEN corban_classify_status(s.status) = 'pago' THEN 'proposta_paga' ELSE 'proposta_aprovada' END
  );