
-- ============================================================
-- ETAPA 6: RPCs de performance
-- ============================================================

-- ------------------------------------------------------------
-- 1) dashboard_message_stats: 4 queries -> 1
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_message_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start timestamptz;
  v_week_start timestamptz;
  v_month_start timestamptz;
  v_today int;
  v_week int;
  v_month int;
  v_sparkline jsonb;
BEGIN
  -- Permissão: só o próprio usuário ou privilegiado
  IF p_user_id <> auth.uid() AND NOT public.is_privileged(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Janelas em America/Sao_Paulo
  v_today_start := (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo'))) AT TIME ZONE 'America/Sao_Paulo';
  v_week_start  := now() - interval '7 days';
  v_month_start := (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))) AT TIME ZONE 'America/Sao_Paulo';

  WITH user_chips AS (
    SELECT id FROM public.chips WHERE user_id = p_user_id
  ),
  msgs AS (
    SELECT created_at FROM public.message_history
    WHERE chip_id IN (SELECT id FROM user_chips)
      AND created_at >= v_month_start
  )
  SELECT
    COUNT(*) FILTER (WHERE created_at >= v_today_start),
    COUNT(*) FILTER (WHERE created_at >= v_week_start),
    COUNT(*)
  INTO v_today, v_week, v_month
  FROM msgs;

  -- Sparkline 7 dias
  WITH days AS (
    SELECT generate_series(0, 6) AS d
  ),
  user_chips AS (
    SELECT id FROM public.chips WHERE user_id = p_user_id
  ),
  daily AS (
    SELECT
      to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date - d, 'YYYY-MM-DD') AS date,
      (SELECT COUNT(*) FROM public.message_history mh
        WHERE mh.chip_id IN (SELECT id FROM user_chips)
          AND mh.created_at >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date - d) AT TIME ZONE 'America/Sao_Paulo'
          AND mh.created_at <  ((now() AT TIME ZONE 'America/Sao_Paulo')::date - d + 1) AT TIME ZONE 'America/Sao_Paulo'
      ) AS count
    FROM days
  )
  SELECT jsonb_agg(jsonb_build_object('date', date, 'count', count) ORDER BY date)
  INTO v_sparkline
  FROM daily;

  RETURN jsonb_build_object(
    'today', COALESCE(v_today, 0),
    'week',  COALESCE(v_week, 0),
    'month', COALESCE(v_month, 0),
    'sparkline', COALESCE(v_sparkline, '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dashboard_message_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_message_stats(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 2) dashboard_chip_summary
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_chip_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chips jsonb;
  v_total int;
  v_connected int;
  v_disconnected int;
  v_queue int;
BEGIN
  IF p_user_id <> auth.uid() AND NOT public.is_privileged(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT
    jsonb_agg(to_jsonb(c) ORDER BY c.slot_number),
    COUNT(*),
    COUNT(*) FILTER (WHERE c.status = 'connected'),
    COUNT(*) FILTER (WHERE c.status <> 'connected')
  INTO v_chips, v_total, v_connected, v_disconnected
  FROM public.chips c
  WHERE c.user_id = p_user_id;

  SELECT COUNT(*) INTO v_queue
  FROM public.message_queue mq
  WHERE mq.status = 'pending'
    AND mq.chip_id IN (SELECT id FROM public.chips WHERE user_id = p_user_id);

  RETURN jsonb_build_object(
    'chips', COALESCE(v_chips, '[]'::jsonb),
    'stats', jsonb_build_object(
      'total', COALESCE(v_total, 0),
      'connected', COALESCE(v_connected, 0),
      'disconnected', COALESCE(v_disconnected, 0)
    ),
    'queue_pending', COALESCE(v_queue, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dashboard_chip_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_chip_summary(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3) leads_paginated: paginação server-side com COUNT total
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leads_paginated(
  p_user_id uuid DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset int;
  v_total int;
  v_rows jsonb;
  v_is_priv boolean;
  v_caller uuid := auth.uid();
  v_search text;
BEGIN
  v_is_priv := public.is_privileged(v_caller);

  -- Não-privilegiado só vê leads atribuídos a si
  IF NOT v_is_priv THEN
    p_user_id := v_caller;
  END IF;

  p_page := GREATEST(p_page, 1);
  p_page_size := LEAST(GREATEST(p_page_size, 1), 200);
  v_offset := (p_page - 1) * p_page_size;
  v_search := CASE WHEN p_search IS NULL OR length(trim(p_search)) = 0 THEN NULL ELSE '%' || trim(p_search) || '%' END;

  WITH filtered AS (
    SELECT *
    FROM public.client_leads l
    WHERE (p_user_id IS NULL OR l.assigned_to = p_user_id)
      AND (p_status IS NULL OR l.status = p_status)
      AND (
        v_search IS NULL OR
        l.nome ILIKE v_search OR
        l.cpf ILIKE v_search OR
        l.telefone ILIKE v_search
      )
  ),
  total_count AS (SELECT COUNT(*) AS c FROM filtered),
  page AS (
    SELECT * FROM filtered
    ORDER BY created_at DESC
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT
    (SELECT c FROM total_count),
    COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
  INTO v_total, v_rows
  FROM page p;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', CEIL(v_total::numeric / p_page_size)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.leads_paginated(uuid,int,int,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leads_paginated(uuid,int,int,text,text) TO authenticated, service_role;
