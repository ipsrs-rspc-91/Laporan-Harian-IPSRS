-- Prevent new reports and Item changes from storing a blank Item.
-- Legacy reports whose Item is already blank remain readable and can be remediated deliberately.
CREATE OR REPLACE FUNCTION public.guard_report_item_required()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.item IS NULL OR btrim(NEW.item) = '' THEN
      RAISE EXCEPTION 'Item wajib dipilih sebelum laporan disimpan.'
        USING ERRCODE = '23514',
              CONSTRAINT = 'reports_item_required_on_write';
    END IF;
  ELSIF NEW.item IS DISTINCT FROM OLD.item THEN
    IF NEW.item IS NULL OR btrim(NEW.item) = '' THEN
      RAISE EXCEPTION 'Item tidak boleh dikosongkan. Pilih Item yang sesuai.'
        USING ERRCODE = '23514',
              CONSTRAINT = 'reports_item_required_on_write';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_report_item_required ON public.reports;
CREATE TRIGGER trg_guard_report_item_required
BEFORE INSERT OR UPDATE OF item ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.guard_report_item_required();

COMMENT ON FUNCTION public.guard_report_item_required()
IS 'Prevents new reports and Item changes from storing a blank Item while preserving legacy rows for controlled remediation.';
