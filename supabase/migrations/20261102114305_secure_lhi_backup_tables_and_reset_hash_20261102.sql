-- Stage 1 security hardening for LHI recovery data.
-- The six dated recovery snapshots are retained for controlled restoration only.
-- No anon/authenticated application user may read or modify these tables.

ALTER TABLE public.lhi_access_settings_backup_20261102 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lhi_agung_obligations_backup_20261102 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lhi_cron_job_backup_20261102 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lhi_discipline_scheduler_backup_20261102 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lhi_incidents_backup_20261102 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lhi_staff_agung_backup_20261102 ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.lhi_access_settings_backup_20261102,
  public.lhi_agung_obligations_backup_20261102,
  public.lhi_cron_job_backup_20261102,
  public.lhi_discipline_scheduler_backup_20261102,
  public.lhi_incidents_backup_20261102,
  public.lhi_staff_agung_backup_20261102
FROM PUBLIC, anon, authenticated, service_role;

-- Keep recovery snapshots read-only to the server role.
-- The postgres owner retains full administrative access for controlled restoration.
GRANT SELECT ON TABLE
  public.lhi_access_settings_backup_20261102,
  public.lhi_agung_obligations_backup_20261102,
  public.lhi_cron_job_backup_20261102,
  public.lhi_discipline_scheduler_backup_20261102,
  public.lhi_incidents_backup_20261102,
  public.lhi_staff_agung_backup_20261102
TO service_role;

-- Never expose the reset hash to authenticated users, including KA IPSRS.
-- The lhi-reset-verify Edge Function reads it with the server-side service_role key.
DROP POLICY IF EXISTS access_settings_read_ka ON public.access_settings;
CREATE POLICY access_settings_read_ka
ON public.access_settings
FOR SELECT
TO authenticated
USING (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'
  AND key <> 'LHI_RESET_CODE_HASH'
);

DROP POLICY IF EXISTS access_settings_insert_ka ON public.access_settings;
CREATE POLICY access_settings_insert_ka
ON public.access_settings
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'
  AND key <> 'LHI_RESET_CODE_HASH'
);

DROP POLICY IF EXISTS access_settings_update_ka ON public.access_settings;
CREATE POLICY access_settings_update_ka
ON public.access_settings
FOR UPDATE
TO authenticated
USING (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'
  AND key <> 'LHI_RESET_CODE_HASH'
)
WITH CHECK (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'
  AND key <> 'LHI_RESET_CODE_HASH'
);

DROP POLICY IF EXISTS access_settings_delete_ka ON public.access_settings;
CREATE POLICY access_settings_delete_ka
ON public.access_settings
FOR DELETE
TO authenticated
USING (
  (SELECT private.current_staff_role()) = 'KA_IPSRS'
  AND key <> 'LHI_RESET_CODE_HASH'
);
