import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg

ROOT = Path(".")
MIGRATION = ROOT / "supabase/migrations/20261102170000_lhi_created_at_monitoring_stage3.sql"
DATABASE_URL = os.environ["DATABASE_URL"]

BOOTSTRAP = r"""
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

CREATE SCHEMA IF NOT EXISTS cron;
CREATE TABLE IF NOT EXISTS cron.job (
  jobid bigserial PRIMARY KEY,
  jobname text UNIQUE,
  schedule text NOT NULL,
  command text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
INSERT INTO cron.job(jobname,schedule,command)
VALUES ('lhi-discipline-scheduler-every-5-minutes','*/5 * * * *',
        'select public.run_lhi_discipline_scheduler();')
ON CONFLICT (jobname) DO NOTHING;

CREATE OR REPLACE FUNCTION cron.schedule(p_jobname text,p_schedule text,p_command text)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO cron.job(jobname,schedule,command)
  VALUES (p_jobname,p_schedule,p_command)
  RETURNING jobid INTO v_id;
  RETURN v_id;
END;
$$;

CREATE TABLE public.staff (
  staff_id text PRIMARY KEY,
  nama text NOT NULL,
  jabatan text,
  role text NOT NULL,
  bidang text,
  status text NOT NULL DEFAULT 'Aktif',
  auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lhi_manual_unblock_until timestamptz
);

CREATE TABLE public.reports (
  report_id text PRIMARY KEY,
  staff_id text NOT NULL,
  tanggal date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz
);

CREATE TABLE public.access_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz,
  updated_by_staff_id text,
  updated_by_name text
);

CREATE TABLE public.lhi_discipline_incidents (
  incident_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deadline_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'GRACE',
  started_by_staff_id text,
  started_by_name text,
  completed_at timestamptz,
  reactivated_at timestamptz
);

CREATE TABLE public.lhi_discipline_obligations (
  obligation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id bigint NOT NULL,
  staff_id text NOT NULL,
  required_date date NOT NULL,
  completed_at timestamptz,
  UNIQUE (incident_id,staff_id,required_date)
);

CREATE TABLE public.lhi_discipline_notifications (
  notification_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL,
  recipient_staff_id text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  read_at timestamptz,
  UNIQUE (event_key,recipient_staff_id)
);

CREATE TABLE public.audit_log (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "timestamp" timestamptz NOT NULL DEFAULT clock_timestamp(),
  username text,
  staff_id text,
  action text NOT NULL,
  report_id text,
  keterangan text,
  field_changed text,
  old_value text,
  new_value text
);

INSERT INTO public.access_settings(key,value)
VALUES ('LHI_GLOBAL_BLOCK','NONAKTIF');
"""

def scalar(cur, sql, params=()):
    cur.execute(sql, params)
    return cur.fetchone()[0]

with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
    with conn.cursor() as cur:
        cur.execute(BOOTSTRAP)
        now = datetime.now(timezone.utc)
        def add_staff(staff_id, age_days, last_input_days=None, manual_days=None, status="Aktif"):
            created = now - timedelta(days=age_days)
            manual = now + timedelta(days=manual_days) if manual_days else None
            cur.execute(
                """INSERT INTO public.staff(staff_id,nama,role,status,created_at,lhi_manual_unblock_until)
                   VALUES (%s,%s,'STAF',%s,%s,%s)""",
                (staff_id, staff_id, status, created, manual),
            )
            if last_input_days is not None:
                created_input = now - timedelta(days=last_input_days)
                # Work/event date intentionally differs from the server input date.
                cur.execute(
                    """INSERT INTO public.reports(report_id,staff_id,tanggal,created_at)
                       VALUES (%s,%s,%s,%s)""",
                    ("R-" + staff_id, staff_id, (now - timedelta(days=25)).date(), created_input),
                )

        # Seed legacy staff before the migration so fallback baseline is exercised.
        add_staff("D8", 8, 8)
        add_staff("MANUAL", 8, 8, manual_days=2)
        add_staff("FRESH", 12, 1)
        add_staff("INACTIVE", 30, None, status="Nonaktif")

        cur.execute(MIGRATION.read_text(encoding="utf-8"))
        print("PASS Stage 3 migration applied to isolated PostgreSQL 17 test database")

        # Initial baseline uses created_at only for legacy rows, explicitly tagged.
        assert scalar(cur, """SELECT count(*) FROM public.lhi_staff_monitoring_state
                              WHERE staff_id='D8' AND baseline_source='LEGACY_CREATED_AT_FALLBACK'""") == 1

        cur.execute("SELECT public.run_lhi_daily_monitoring()")
        assert scalar(cur, """SELECT individual_blocked_at IS NOT NULL
                              FROM public.lhi_staff_monitoring_state WHERE staff_id='D8'""") is True
        assert scalar(cur, """SELECT last_calculated_days
                              FROM public.lhi_staff_monitoring_state WHERE staff_id='D8'""") == 8
        assert scalar(cur, """SELECT last_calculated_days
                              FROM public.lhi_staff_monitoring_state WHERE staff_id='FRESH'""") == 1
        assert scalar(cur, """SELECT individual_blocked_at IS NULL
                              FROM public.lhi_staff_monitoring_state WHERE staff_id='MANUAL'""") is True
        assert scalar(cur, "SELECT status FROM public.staff WHERE staff_id='D8'") == "Aktif"
        assert scalar(cur, "SELECT status FROM public.staff WHERE staff_id='INACTIVE'") == "Nonaktif"
        assert scalar(cur, """SELECT count(DISTINCT event_key) FROM public.lhi_discipline_notifications
                              WHERE event_key LIKE 'D8:%%:DAY_%%'""") == 4
        print("PASS day-8 individual block, warnings, manual-unblock window, and employment-status separation")

        # A valid server input clears the individual block even if work date is old.
        cur.execute(
            """INSERT INTO public.reports(report_id,staff_id,tanggal,created_at)
               VALUES ('R-D8-NEW','D8',%s,clock_timestamp())""",
            ((now - timedelta(days=25)).date(),),
        )
        assert scalar(cur, """SELECT individual_blocked_at IS NULL
                              FROM public.lhi_staff_monitoring_state WHERE staff_id='D8'""") is True

        # Cancelling that only new valid input immediately restores day-8 blocking.
        cur.execute("UPDATE public.reports SET deleted_at=clock_timestamp() WHERE report_id='R-D8-NEW'")
        assert scalar(cur, """SELECT individual_blocked_at IS NOT NULL
                              FROM public.lhi_staff_monitoring_state WHERE staff_id='D8'""") is True
        assert scalar(cur, "SELECT status FROM public.staff WHERE staff_id='D8'") == "Aktif"
        print("PASS cancellation immediately recalculates the streak and blocks without changing employment status")

        # Day 10 triggers the global lock and snapshots only staff already at day 10.
        add_staff("D10", 10, 10)
        cur.execute("SELECT public.run_lhi_daily_monitoring()")
        assert scalar(cur, "SELECT value FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK'") == "AKTIF"
        incident_id = scalar(cur, "SELECT max(incident_id) FROM public.lhi_discipline_incidents WHERE status='LOCKED'")
        assert scalar(cur, """SELECT count(*) FROM public.lhi_discipline_obligations
                              WHERE incident_id=%s AND staff_id='D10'""", (incident_id,)) == 1
        assert scalar(cur, """SELECT count(*) FROM public.lhi_discipline_obligations
                              WHERE incident_id=%s AND staff_id='D8'""", (incident_id,)) == 0
        print("PASS day-10 global lock and delinquent-only snapshot")

        # Open a simulated grace window that has already reached its deadline.
        grace_start = now - timedelta(hours=13)
        grace_deadline = now - timedelta(hours=1)
        cur.execute("UPDATE public.access_settings SET value='NONAKTIF' WHERE key='LHI_GLOBAL_BLOCK'")
        cur.execute(
            """UPDATE public.lhi_discipline_incidents
               SET status='GRACE',started_at=%s,deadline_at=%s
               WHERE incident_id=%s""",
            (grace_start, grace_deadline, incident_id),
        )
        assert scalar(cur, """SELECT count(*) FROM public.lhi_staff_monitoring_state
                              WHERE individual_blocked_at IS NOT NULL""") == 0

        # A valid input created inside the grace interval fulfils the snapshot.
        cur.execute(
            """INSERT INTO public.reports(report_id,staff_id,tanggal,created_at)
               VALUES ('R-D10-GRACE','D10',%s,%s)""",
            ((now - timedelta(days=30)).date(), grace_start + timedelta(hours=1)),
        )

        # Reactivate this employee, include the snapshot row, then deactivate during grace.
        # The row must remain in the snapshot but be excluded from the deadline count.
        cur.execute("UPDATE public.staff SET status='Aktif' WHERE staff_id='INACTIVE'")
        assert scalar(cur, """SELECT active_since >= clock_timestamp()-interval '1 minute'
                              FROM public.lhi_staff_monitoring_state WHERE staff_id='INACTIVE'""") is True
        cur.execute(
            """INSERT INTO public.lhi_discipline_obligations(incident_id,staff_id,required_date)
               VALUES (%s,'INACTIVE',%s)""",
            (incident_id, now.date()),
        )
        cur.execute("UPDATE public.staff SET status='Nonaktif' WHERE staff_id='INACTIVE'")
        assert scalar(cur, """SELECT obligation_status FROM public.lhi_discipline_obligations
                              WHERE incident_id=%s AND staff_id='INACTIVE'""", (incident_id,)) == "EXCLUDED_NONACTIVE"

        cur.execute("SELECT public.run_lhi_discipline_scheduler()")
        assert scalar(cur, "SELECT status FROM public.lhi_discipline_incidents WHERE incident_id=%s", (incident_id,)) == "COMPLETED"
        assert scalar(cur, "SELECT value FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK'") == "NONAKTIF"
        assert scalar(cur, """SELECT count(*) FROM public.lhi_obligation_audit
                              WHERE incident_id=%s AND cause='EMPLOYMENT_STATUS_NONACTIVE'""", (incident_id,)) == 1
        print("PASS grace fulfilment, NONAKTIF exclusion, and immutable obligation audit")

        # New grace: cancelling the only grace-period LHI reopens the obligation.
        cur.execute(
            """INSERT INTO public.lhi_discipline_incidents(started_at,deadline_at,status)
               VALUES (clock_timestamp()-interval '1 hour',clock_timestamp()+interval '11 hours','GRACE')
               RETURNING incident_id"""
        )
        second_incident = cur.fetchone()[0]
        cur.execute(
            """INSERT INTO public.lhi_discipline_obligations(incident_id,staff_id,required_date)
               VALUES (%s,'D10',%s)""",
            (second_incident, now.date()),
        )
        cur.execute(
            """INSERT INTO public.reports(report_id,staff_id,tanggal,created_at)
               VALUES ('R-D10-GRACE-CANCEL','D10',%s,clock_timestamp())""",
            ((now - timedelta(days=30)).date(),),
        )
        cur.execute("SELECT public.run_lhi_discipline_scheduler()")
        assert scalar(cur, """SELECT obligation_status FROM public.lhi_discipline_obligations
                              WHERE incident_id=%s AND staff_id='D10'""", (second_incident,)) == "FULFILLED"

        # Let the deadline pass before cancellation. The report trigger must not
        # restart normal streak monitoring while the GRACE incident is unresolved.
        cur.execute(
            "UPDATE public.lhi_discipline_incidents SET deadline_at=clock_timestamp()-interval '1 second' WHERE incident_id=%s",
            (second_incident,),
        )
        cur.execute("UPDATE public.reports SET deleted_at=clock_timestamp() WHERE report_id='R-D10-GRACE-CANCEL'")
        assert scalar(cur, "SELECT status FROM public.lhi_discipline_incidents WHERE incident_id=%s", (second_incident,)) == "GRACE"
        cur.execute("SELECT public.run_lhi_discipline_scheduler()")
        assert scalar(cur, """SELECT obligation_status FROM public.lhi_discipline_obligations
                              WHERE incident_id=%s AND staff_id='D10'""", (second_incident,)) == "PENDING"
        assert scalar(cur, """SELECT count(*) FROM public.lhi_obligation_audit
                              WHERE incident_id=%s AND cause='LHI_CANCELLED_OR_INVALIDATED'""", (second_incident,)) == 1
        assert scalar(cur, "SELECT status FROM public.lhi_discipline_incidents WHERE incident_id=%s", (second_incident,)) == "EXPIRED"
        assert scalar(cur, "SELECT value FROM public.access_settings WHERE key='LHI_GLOBAL_BLOCK'") == "AKTIF"
        print("PASS grace-period cancellation restores PENDING and reactivates global block at deadline")

        assert scalar(cur, "SELECT count(*) FROM public.staff_employment_status_history") >= 6
        assert scalar(cur, """SELECT count(*) FROM cron.job WHERE jobname='lhi-daily-monitoring-wib'
                              AND schedule='0 17 * * *'""") == 1
        assert scalar(cur, """SELECT count(*) FROM cron.job WHERE jobname='lhi-discipline-scheduler-every-5-minutes'
                              AND schedule='*/5 * * * *'""") == 1
        print("PASS employment status history and WIB/duration cron schedules")

print("ALL STAGE 3 POSTGRES INTEGRATION TESTS PASSED")
