-- Enable pg_trgm for fuzzy name matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create seller mapping table
CREATE TABLE public.corban_seller_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corban_name text NOT NULL UNIQUE,
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  similarity_score numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.corban_seller_mapping ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Privileged can manage seller mapping"
ON public.corban_seller_mapping
FOR ALL
TO authenticated
USING (is_privileged(auth.uid()))
WITH CHECK (is_privileged(auth.uid()));

CREATE POLICY "Authenticated can view seller mapping"
ON public.corban_seller_mapping
FOR SELECT
TO authenticated
USING (true);

-- Updated_at trigger
CREATE TRIGGER update_corban_seller_mapping_updated_at
BEFORE UPDATE ON public.corban_seller_mapping
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-match function: finds best profile match for each corban seller name
CREATE OR REPLACE FUNCTION public.auto_match_corban_sellers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_count integer := 0;
  inserted_count integer := 0;
  rec RECORD;
  best_user_id uuid;
  best_score numeric;
  best_name text;
BEGIN
  -- Insert new seller names from snapshots that don't exist yet
  INSERT INTO corban_seller_mapping (corban_name)
  SELECT DISTINCT vendedor_nome
  FROM corban_propostas_snapshot
  WHERE vendedor_nome IS NOT NULL AND vendedor_nome != ''
    AND vendedor_nome NOT IN (SELECT corban_name FROM corban_seller_mapping)
  ON CONFLICT (corban_name) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  -- For each unmapped seller, try to find best matching profile
  FOR rec IN
    SELECT id, corban_name FROM corban_seller_mapping WHERE user_id IS NULL
  LOOP
    SELECT p.user_id, p.name, similarity(LOWER(rec.corban_name), LOWER(p.name)) AS score
    INTO best_user_id, best_name, best_score
    FROM profiles p
    WHERE p.name IS NOT NULL AND p.name != ''
    ORDER BY similarity(LOWER(rec.corban_name), LOWER(p.name)) DESC
    LIMIT 1;

    IF best_score >= 0.4 THEN
      UPDATE corban_seller_mapping
      SET user_id = best_user_id, similarity_score = best_score, updated_at = now()
      WHERE id = rec.id;
      matched_count := matched_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', inserted_count,
    'matched', matched_count
  );
END;
$$;

-- Run initial population
SELECT auto_match_corban_sellers();