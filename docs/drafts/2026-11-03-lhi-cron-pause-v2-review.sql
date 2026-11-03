-- REVIEW DRAFT ONLY — NOT A DEPLOYABLE MIGRATION.
-- Pause the existing LHI cron before applying schema/scheduler/recovery changes.
-- This prevents the legacy scheduler from mutating the locked incident while
-- the new schema and recovery functions are being installed.
-- Run only after a recoverable production backup has been verified.

BEGIN;

DO $cron_pause$
DECLARE
  v_job_id bigint;
  v_active boolean;
  v_count integer;
BEGIN
  IF to_regprocedure('cron.alter_job(bigint,text,text,text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'cron.alter_job tidak tersedia; cron lama tidak diubah.';
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM cron.job
  WHERE jobname = 'lhi-discipline-scheduler-every-5-minutes';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Job LHI scheduler harus tepat satu; ditemukan %.', v_count;
  END IF;

  SELECT jobid, active INTO v_job_id, v_active
  FROM cron.job
  WHERE jobname = 'lhi-discipline-scheduler-every-5-minutes';

  IF v_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Cron LHI sudah tidak aktif; pause dibatalkan untuk menghindari asumsi.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job_run_details
    WHERE jobid = v_job_id
      AND status = 'running'
  ) THEN
    RAISE EXCEPTION 'Scheduler LHI sedang berjalan; tunggu sampai eksekusi selesai sebelum pause.';
  END IF;

  PERFORM cron.alter_job(job_id := v_job_id, active := false);

  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobid = v_job_id
      AND jobname = 'lhi-discipline-scheduler-every-5-minutes'
      AND active IS FALSE
      AND schedule = '*/5 * * * *'
  ) THEN
    RAISE EXCEPTION 'Verifikasi pause cron gagal; transaksi dibatalkan.';
  END IF;
END
$cron_pause$;

COMMIT;

SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'lhi-discipline-scheduler-every-5-minutes';
