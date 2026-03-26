
-- Indices for performance optimization
CREATE INDEX IF NOT EXISTS idx_message_history_created_chip_dir 
  ON public.message_history (created_at, chip_id, direction);

CREATE INDEX IF NOT EXISTS idx_client_leads_created_assigned_status 
  ON public.client_leads (created_at, assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_client_leads_assigned_to 
  ON public.client_leads (assigned_to);

-- Update get_performance_stats to be more efficient with chip_type filter
CREATE OR REPLACE FUNCTION public.get_performance_stats(
  _date_from timestamptz DEFAULT NULL,
  _date_to timestamptz DEFAULT NULL
)
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
      cl.assigned_to as user_id,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE cl.contacted_at IS NOT NULL) as contacted,
      COUNT(*) FILTER (WHERE UPPER(cl.status) = 'APROVADO') as approved,
      COUNT(*) FILTER (WHERE cl.status IS NULL OR cl.status = 'pendente') as pending
    FROM client_leads cl
    WHERE (_date_from IS NULL OR cl.created_at >= _date_from)
      AND (_date_to IS NULL OR cl.created_at <= _date_to)
    GROUP BY cl.assigned_to
  ) sub;

  -- Message stats per chip (excluding warming chips)
  SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
  INTO msg_stats
  FROM (
    SELECT
      mh.chip_id,
      COUNT(*) FILTER (WHERE mh.direction = 'outgoing') as sent,
      COUNT(*) FILTER (WHERE mh.direction = 'incoming') as received
    FROM message_history mh
    INNER JOIN chips c ON c.id = mh.chip_id AND c.chip_type != 'warming'
    WHERE (_date_from IS NULL OR mh.created_at >= _date_from)
      AND (_date_to IS NULL OR mh.created_at <= _date_to)
    GROUP BY mh.chip_id
  ) sub;

  result := jsonb_build_object(
    'leads', lead_stats,
    'messages', msg_stats
  );
  RETURN result;
END;
$$;
