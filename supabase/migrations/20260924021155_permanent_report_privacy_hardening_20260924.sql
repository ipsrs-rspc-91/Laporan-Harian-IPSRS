-- Permanent IPSRS report privacy hardening.
-- Rule: KA IPSRS reports are private to KA IPSRS; other users cannot view/edit
-- them, even when role_snapshot is stale. The same rule applies to history,
-- audit entries tied to a report, dashboard aggregates, monitoring and recap.

create or replace function private.can_view_report(p_staff_id text, p_role_snapshot text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  me text;
  myrole text;
  ownerrole text;
  team_setting text;
begin
  me := private.current_staff_id();
  myrole := private.current_staff_role();

  if me is null then return false; end if;
  if myrole = 'KA_IPSRS' then return true; end if;
  if p_staff_id = me then return true; end if;
  if upper(coalesce(p_role_snapshot,'')) = 'KA_IPSRS' then return false; end if;

  select upper(coalesce(s.role,'')) into ownerrole
  from public.staff s
  where s.staff_id = p_staff_id
    and s.status = 'Aktif'
  limit 1;

  if ownerrole = 'KA_IPSRS' then return false; end if;

  select upper(value) into team_setting
  from public.access_settings
  where key = 'LAPORAN_TIM';

  return coalesce(team_setting,'AKTIF') = 'AKTIF';
end;
$function$;

create or replace function private.can_edit_report(p_staff_id text, p_role_snapshot text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  me text;
  myrole text;
  ownerrole text;
begin
  me := private.current_staff_id();
  myrole := private.current_staff_role();

  if me is null then return false; end if;
  if myrole = 'KA_IPSRS' then return true; end if;
  if p_staff_id = me then return true; end if;
  if upper(coalesce(p_role_snapshot,'')) = 'KA_IPSRS' then return false; end if;

  select upper(coalesce(s.role,'')) into ownerrole
  from public.staff s
  where s.staff_id = p_staff_id
    and s.status = 'Aktif'
  limit 1;

  if ownerrole = 'KA_IPSRS' then return false; end if;

  return exists(
    select 1
    from public.edit_permissions ep
    where ep.granted_to_staff_id = me
      and ep.is_active = true
  );
end;
$function$;

drop policy if exists report_history_read_admins on public.report_history;
create policy report_history_select_authorized
on public.report_history
for select
to authenticated
using (
  (select private.current_staff_role()) = any(array['KA_IPSRS','ADMINISTRASI']::text[])
  and exists (
    select 1
    from public.reports r
    where r.report_id = report_history.report_id
      and (select private.can_view_report(r.staff_id,r.role_snapshot))
  )
);

drop policy if exists audit_log_read_admins on public.audit_log;
create policy audit_log_select_authorized
on public.audit_log
for select
to authenticated
using (
  (select private.current_staff_role()) = 'KA_IPSRS'
  or (
    (select private.current_staff_role()) = 'ADMINISTRASI'
    and (
      audit_log.report_id is null
      or exists (
        select 1
        from public.reports r
        where r.report_id = audit_log.report_id
          and (select private.can_view_report(r.staff_id,r.role_snapshot))
      )
    )
  )
);

-- The browser never needs anonymous access to these internal objects.
revoke all on table public.reports, public.report_history, public.audit_log,
  public.staff, public.access_settings, public.edit_permissions from anon;

grant select, insert, update, delete on table public.reports to authenticated;
grant select on table public.report_history, public.audit_log to authenticated;

alter table public.reports enable row level security;
alter table public.report_history enable row level security;
alter table public.audit_log enable row level security;
