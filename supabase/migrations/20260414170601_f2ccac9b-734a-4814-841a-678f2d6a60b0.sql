
-- Recreate the trigger that was lost
CREATE OR REPLACE TRIGGER on_snapshot_status_change
  BEFORE UPDATE ON public.corban_propostas_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION public.track_snapshot_status_change();
