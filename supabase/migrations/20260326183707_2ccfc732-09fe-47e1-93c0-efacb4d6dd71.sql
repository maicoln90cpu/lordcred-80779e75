
-- RPC: get_lead_status_distribution
-- Returns all real status values with counts, filtered by date range
CREATE OR REPLACE FUNCTION public.get_lead_status_distribution(
  _date_from timestamptz DEFAULT NULL,
  _date_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      COALESCE(NULLIF(TRIM(status), ''), 'pendente') as status,
      COUNT(*) as count
    FROM client_leads
    WHERE (_date_from IS NULL OR created_at >= _date_from)
      AND (_date_to IS NULL OR created_at <= _date_to)
    GROUP BY COALESCE(NULLIF(TRIM(status), ''), 'pendente')
    ORDER BY count DESC
  ) sub;
  RETURN result;
END;
$$;

-- RPC: get_avg_response_time
-- Calculates average time between lead creation and first contact per seller
CREATE OR REPLACE FUNCTION public.get_avg_response_time(
  _date_from timestamptz DEFAULT NULL,
  _date_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      assigned_to as user_id,
      ROUND(AVG(EXTRACT(EPOCH FROM (contacted_at - created_at)) / 3600)::numeric, 1) as avg_hours
    FROM client_leads
    WHERE contacted_at IS NOT NULL
      AND (_date_from IS NULL OR created_at >= _date_from)
      AND (_date_to IS NULL OR created_at <= _date_to)
    GROUP BY assigned_to
  ) sub;
  RETURN result;
END;
$$;
