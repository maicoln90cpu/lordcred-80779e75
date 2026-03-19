-- Add media columns to message_shortcuts
ALTER TABLE public.message_shortcuts
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_filename text;

-- RPC: get_lead_counts - returns status and profile counts for a user
CREATE OR REPLACE FUNCTION public.get_lead_counts(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'by_status', COALESCE(jsonb_object_agg_strict(
      COALESCE(status, 'pendente'),
      cnt
    ) FILTER (WHERE cnt IS NOT NULL), '{}'::jsonb),
    'by_perfil', COALESCE(jsonb_object_agg_strict(
      perfil,
      pcnt
    ) FILTER (WHERE perfil IS NOT NULL AND pcnt IS NOT NULL), '{}'::jsonb)
  )
  FROM (
    SELECT status, perfil, COUNT(*) as cnt,
           COUNT(*) FILTER (WHERE perfil IS NOT NULL) as pcnt
    FROM client_leads
    WHERE assigned_to = _user_id
    GROUP BY status, perfil
  ) sub
$$;

-- Simpler approach: separate status and perfil counts
DROP FUNCTION IF EXISTS public.get_lead_counts(uuid);

CREATE OR REPLACE FUNCTION public.get_lead_counts(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  status_counts jsonb;
  perfil_counts jsonb;
  total_count bigint;
  contacted_count bigint;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status != 'pendente' AND status IS NOT NULL)
  INTO total_count, contacted_count
  FROM client_leads WHERE assigned_to = _user_id;

  SELECT COALESCE(jsonb_object_agg(s, c), '{}'::jsonb)
  INTO status_counts
  FROM (
    SELECT COALESCE(status, 'pendente') as s, COUNT(*) as c
    FROM client_leads WHERE assigned_to = _user_id
    GROUP BY COALESCE(status, 'pendente')
  ) sub;

  SELECT COALESCE(jsonb_object_agg(p, c), '{}'::jsonb)
  INTO perfil_counts
  FROM (
    SELECT perfil as p, COUNT(*) as c
    FROM client_leads WHERE assigned_to = _user_id AND perfil IS NOT NULL
    GROUP BY perfil
  ) sub;

  result := jsonb_build_object(
    'total', total_count,
    'contacted', contacted_count,
    'by_status', status_counts,
    'by_perfil', perfil_counts
  );
  RETURN result;
END;
$$;

-- RPC: get_performance_stats - returns aggregated metrics
CREATE OR REPLACE FUNCTION public.get_performance_stats(_date_from timestamptz DEFAULT NULL, _date_to timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  lead_stats jsonb;
  msg_stats jsonb;
BEGIN
  -- Lead stats per user
  SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
  INTO lead_stats
  FROM (
    SELECT
      assigned_to as user_id,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE contacted_at IS NOT NULL) as contacted,
      COUNT(*) FILTER (WHERE UPPER(status) = 'APROVADO') as approved,
      COUNT(*) FILTER (WHERE status IS NULL OR status = 'pendente') as pending
    FROM client_leads
    WHERE (_date_from IS NULL OR created_at >= _date_from)
      AND (_date_to IS NULL OR created_at <= _date_to)
    GROUP BY assigned_to
  ) sub;

  -- Message stats per chip
  SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
  INTO msg_stats
  FROM (
    SELECT
      chip_id,
      COUNT(*) FILTER (WHERE direction = 'outgoing') as sent,
      COUNT(*) FILTER (WHERE direction = 'incoming') as received
    FROM message_history
    WHERE (_date_from IS NULL OR created_at >= _date_from)
      AND (_date_to IS NULL OR created_at <= _date_to)
    GROUP BY chip_id
  ) sub;

  result := jsonb_build_object(
    'leads', lead_stats,
    'messages', msg_stats
  );
  RETURN result;
END;
$$;