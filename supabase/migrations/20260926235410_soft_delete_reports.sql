-- Soft-delete support for incorrect IPSRS reports.
-- Reports remain recoverable and auditable; normal reads exclude deleted rows.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by_staff_id text,
  ADD COLUMN IF NOT EXISTS deleted_by_name text,
  ADD COLUMN IF NOT EXISTS delete_reason text;

CREATE INDEX IF NOT EXISTS reports_active_tanggal_idx
  ON public.reports (tanggal DESC, pukul DESC)
  WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS reports_select_authorized ON public.reports;
CREATE POLICY reports_select_authorized
  ON public.reports FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (SELECT private.can_view_report(reports.staff_id, reports.role_snapshot))
  );

DROP POLICY IF EXISTS reports_update_authorized ON public.reports;
CREATE POLICY reports_update_authorized
  ON public.reports FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (SELECT private.can_edit_report(reports.staff_id, reports.role_snapshot))
  )
  WITH CHECK (
    deleted_at IS NULL
    AND (SELECT private.can_edit_report(reports.staff_id, reports.role_snapshot))
  );
