\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA private;

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE public.staff (
  staff_id text PRIMARY KEY,
  nama text NOT NULL,
  jabatan text,
  role text NOT NULL,
  bidang text,
  status text NOT NULL,
  auth_user_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz,
  last_login_at timestamptz,
  last_seen_at timestamptz,
  last_login_device text,
  lhi_manual_unblock_until timestamptz,
  lhi_discipline_reset_at timestamptz
);

CREATE TABLE public.reports (
  report_id text PRIMARY KEY,
  staff_id text NOT NULL REFERENCES public.staff(staff_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  role_snapshot text,
  tanggal date
);

CREATE TABLE public.lhi_discipline_incidents (
  incident_id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL,
  deadline_at timestamptz NOT NULL,
  status text NOT NULL,
  started_by_staff_id text,
  started_by_name text,
  completed_at timestamptz,
  reactivated_at timestamptz
);

CREATE TABLE public.lhi_discipline_obligations (
  obligation_id bigserial PRIMARY KEY,
  incident_id bigint NOT NULL REFERENCES public.lhi_discipline_incidents(incident_id),
  staff_id text NOT NULL REFERENCES public.staff(staff_id),
  required_date date NOT NULL,
  completed_at timestamptz,
  excluded_at timestamptz,
  UNIQUE (incident_id, staff_id, required_date)
);

CREATE TABLE public.access_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz,
  updated_by_staff_id text,
  updated_by_name text
);

CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY,
  username text,
  staff_id text,
  action text,
  report_id text,
  keterangan text,
  field_changed text,
  old_value text,
  new_value text
);

CREATE TABLE public.lhi_discipline_notifications (
  event_key text NOT NULL,
  recipient_staff_id text NOT NULL,
  subject text,
  message text,
  UNIQUE (event_key, recipient_staff_id)
);

CREATE TABLE public.report_history (report_id text);
CREATE TABLE public.edit_permissions (is_active boolean DEFAULT true);
CREATE TABLE public.migration_errors (id bigserial PRIMARY KEY);
CREATE TABLE public.master_data (id bigserial PRIMARY KEY, is_active boolean DEFAULT true);

CREATE FUNCTION private.current_staff_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,auth,pg_temp AS $$
  SELECT staff_id FROM public.staff WHERE auth_user_id=auth.uid() LIMIT 1
$$;
CREATE FUNCTION private.current_staff_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,auth,pg_temp AS $$
  SELECT role FROM public.staff WHERE auth_user_id=auth.uid() LIMIT 1
$$;
CREATE FUNCTION private.can_view_report(p_staff_id text,p_role_snapshot text) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE FUNCTION private.can_edit_report(p_staff_id text,p_role_snapshot text) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT true $$;

GRANT USAGE ON SCHEMA public, private, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_data ENABLE ROW LEVEL SECURITY;
