-- REVIEW DRAFT ONLY — NOT A DEPLOYABLE MIGRATION.
-- Switch the existing LHI five-minute cron job to scheduler v2.
-- Depends on schema-v2, scheduler-v2, and atomic-reset-v2 SQL having been
-- reviewed and applied in a disposable/non-production Supabase project first.
-- Run after the dedicated pause script. It preserves the existing job ID, job name, and cadence, then re-enables the same job.
-- It must never create a second LHI scheduler job.

BEGIN;

DO $cron_switch$
DECLARE
  v_job_id bigint;
  v_job_name text;
  v_schedule text;
  v_command text;
  v_active boolean;
  v_lhi_job_count integer;
BEGIN
  IF to_regprocedure('public.run_lhi_discipline_scheduler_v2()') IS NULL THEN
    RAISE EXCEPTION 'Scheduler v2 belum tersedia; cron lama tidak diubah.';
  END IF;

  IF to_regprocedure('cron.alter_job(bigint,text,text,text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'cron.alter_job tidak tersedia; cron lama tidak diubah.';
  END IF;

  SELECT count(*)::integer
  INTO v_lhi_job_count
  FROM cron.job
  WHERE jobname = 'lhi-discipline-scheduler-every-5-minutes';

  IF v_lhi_job_count <> 1 THEN
    RAISE EXCEPTION
      'Ditemukan % job dengan nama LHI scheduler; wajib tepat satu sebelum cutover.',
      v_lhi_job_count;
  END IF;

  SELECT jobid, jobname, schedule, command, active
  INTO v_job_id, v_job_name, v_schedule, v_command, v_active
  FROM cron.job
  WHERE jobname = 'lhi-discipline-scheduler-every-5-minutes';

  IF v_schedule IS DISTINCT FROM '*/5 * * * *' THEN
    RAISE EXCEPTION 'Jadwal cron berubah dari */5 * * * *; cutover dibatalkan.';
  END IF;

  IF v_active IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Cron LHI harus sudah dipause melalui cron-pause-v2; cutover dibatalkan.';
  END IF;

  IF v_command NOT IN (
    'select public.run_lhi_discipline_scheduler();',
    'select public.run_lhi_discipline_scheduler_v2();'
  ) THEN
    RAISE EXCEPTION 'Perintah cron saat ini tidak dikenal; cutover dibatalkan.';
  END IF;

  PERFORM cron.alter_job(
    job_id := v_job_id,
    command := 'select public.run_lhi_discipline_scheduler_v2();',
    active := true
  );

  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobid = v_job_id
      AND jobname = v_job_name
      AND schedule = '*/5 * * * *'
      AND active IS TRUE
      AND command = 'select public.run_lhi_discipline_scheduler_v2();'
  ) THEN
    RAISE EXCEPTION 'Verifikasi cron v2 gagal; transaksi dibatalkan.';
  END IF;

  IF (
    SELECT count(*)
    FROM cron.job
    WHERE active IS TRUE
      AND command ILIKE '%run_lhi_discipline_scheduler%'
  ) <> 1 THEN
    RAISE EXCEPTION 'Terdapat job scheduler LHI aktif ganda; transaksi dibatalkan.';
  END IF;
END
$cron_switch$;

COMMIT;

-- Read-only postcondition for the deployment log:
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'lhi-discipline-scheduler-every-5-minutes';
