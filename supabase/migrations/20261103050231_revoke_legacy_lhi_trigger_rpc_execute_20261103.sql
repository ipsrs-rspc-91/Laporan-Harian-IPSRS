DO $revoke_legacy_lhi_functions$
BEGIN
  IF to_regprocedure('public.protect_lhi_manual_unblock_status()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.protect_lhi_manual_unblock_status() FROM PUBLIC, anon, authenticated, service_role;
  END IF;
  IF to_regprocedure('public.reactivate_lhi_staff_after_report()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.reactivate_lhi_staff_after_report() FROM PUBLIC, anon, authenticated, service_role;
  END IF;
END
$revoke_legacy_lhi_functions$;
