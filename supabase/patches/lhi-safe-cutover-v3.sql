-- LHI SAFE CUTOVER V3 — REVIEW/PRE-PRODUCTION PATCH ONLY
-- This file is intentionally outside supabase/migrations. Do not apply to production
-- until the full scheduler and login integration tests pass.
--
-- Invariants:
-- 1) staff.status is employment status only (Aktif / Nonaktif).
-- 2) individual app blocks live in lhi_individual_access_blocks.
-- 3) a grace snapshot is one row per staff member, not one row per missing day.
-- 4) becoming Nonaktif permanently excludes the member from this incident snapshot.
-- 5) grace expiry is evaluated only at deadline_at; reports count by created_at WIB.

begin;

create table if not exists public.lhi_individual_access_blocks (
  staff_id text primary key references public.staff(staff_id) on update cascade on delete restrict,
  reason text not null default 'LHI_NONCOMPLIANCE',
  blocked_at timestamptz not null default clock_timestamp(),
  incident_id bigint null references public.lhi_discipline_incidents(incident_id),
  active boolean not null default true,
  cleared_at timestamptz null,
  cleared_by_staff_id text null,
  clear_reason text null,
  constraint lhi_individual_access_blocks_state_ck
    check ((active and cleared_at is null) or (not active and cleared_at is not null))
);

create index if not exists lhi_individual_access_blocks_active_idx
  on public.lhi_individual_access_blocks(active, staff_id);

create table if not exists public.lhi_discipline_snapshot_members (
  incident_id bigint not null references public.lhi_discipline_incidents(incident_id) on delete restrict,
  staff_id text not null references public.staff(staff_id) on update cascade on delete restrict,
  employment_status_at_snapshot text not null,
  obligation_status text not null default 'PENDING',
  snapshot_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz null,
  excluded_at timestamptz null,
  exclusion_reason text null,
  last_evaluated_at timestamptz null,
  primary key (incident_id, staff_id),
  constraint lhi_snapshot_member_status_ck
    check (obligation_status in ('PENDING','COMPLETED','EXCLUDED_NONACTIVE'))
);

create index if not exists lhi_snapshot_members_status_idx
  on public.lhi_discipline_snapshot_members(incident_id, obligation_status);

create table if not exists public.lhi_staff_monitoring_state (
  staff_id text primary key references public.staff(staff_id) on update cascade on delete restrict,
  monitoring_started_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.lhi_individual_access_blocks enable row level security;
alter table public.lhi_discipline_snapshot_members enable row level security;
alter table public.lhi_staff_monitoring_state enable row level security;

revoke all on public.lhi_individual_access_blocks from public, anon, authenticated;
revoke all on public.lhi_discipline_snapshot_members from public, anon, authenticated;
revoke all on public.lhi_staff_monitoring_state from public, anon, authenticated;
grant select, insert, update, delete on public.lhi_individual_access_blocks to service_role;
grant select, insert, update, delete on public.lhi_discipline_snapshot_members to service_role;
grant select, insert, update, delete on public.lhi_staff_monitoring_state to service_role;

create or replace function public.lhi_track_employment_status_v3()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if lower(coalesce(new.status,'')) = 'nonaktif' then
      update public.lhi_discipline_snapshot_members
         set obligation_status = 'EXCLUDED_NONACTIVE',
             excluded_at = clock_timestamp(),
             exclusion_reason = 'STATUS NONAKTIF',
             completed_at = null,
             last_evaluated_at = clock_timestamp()
       where staff_id = new.staff_id
         and obligation_status <> 'EXCLUDED_NONACTIVE'
         and exists (
           select 1 from public.lhi_discipline_incidents i
            where i.incident_id = lhi_discipline_snapshot_members.incident_id
              and i.status = 'GRACE'
         );

      update public.lhi_individual_access_blocks
         set active = false,
             cleared_at = clock_timestamp(),
             clear_reason = 'EMPLOYMENT_STATUS_NONACTIVE'
       where staff_id = new.staff_id and active = true;

    elsif lower(coalesce(new.status,'')) = 'aktif'
      and lower(coalesce(old.status,'')) <> 'aktif' then
      insert into public.lhi_staff_monitoring_state(staff_id, monitoring_started_at, updated_at)
      values(new.staff_id, clock_timestamp(), clock_timestamp())
      on conflict(staff_id) do update
        set monitoring_started_at = excluded.monitoring_started_at,
            updated_at = excluded.updated_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lhi_track_employment_status_v3 on public.staff;
create trigger trg_lhi_track_employment_status_v3
after update of status on public.staff
for each row execute function public.lhi_track_employment_status_v3();

-- Refresh one member's grace obligation from live, non-deleted reports.
-- A later cancellation makes the obligation pending again unless the member
-- has been excluded because employment status became NONAKTIF.
create or replace function public.lhi_refresh_grace_snapshot_v3(p_incident_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_deadline timestamptz;
  v_total integer := 0;
  v_completed integer := 0;
  v_excluded integer := 0;
  v_pending integer := 0;
begin
  select deadline_at into v_deadline
    from public.lhi_discipline_incidents
   where incident_id = p_incident_id and status = 'GRACE'
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'INCIDENT_NOT_IN_GRACE');
  end if;

  update public.lhi_discipline_snapshot_members m
     set obligation_status = case
           when lower(coalesce(s.status,'')) = 'nonaktif' then 'EXCLUDED_NONACTIVE'
           when exists (
             select 1 from public.reports r
              where r.staff_id = m.staff_id
                and r.deleted_at is null
                and r.created_at >= (
                  select i.started_at from public.lhi_discipline_incidents i
                   where i.incident_id = m.incident_id
                )
                and r.created_at < v_deadline
           ) then 'COMPLETED'
           else 'PENDING'
         end,
         completed_at = case
           when lower(coalesce(s.status,'')) = 'nonaktif' then null
           when exists (
             select 1 from public.reports r
              where r.staff_id = m.staff_id
                and r.deleted_at is null
                and r.created_at >= (
                  select i.started_at from public.lhi_discipline_incidents i
                   where i.incident_id = m.incident_id
                )
                and r.created_at < v_deadline
           ) then coalesce(m.completed_at, v_now)
           else null
         end,
         excluded_at = case when lower(coalesce(s.status,'')) = 'nonaktif'
                            then coalesce(m.excluded_at, v_now) else m.excluded_at end,
         exclusion_reason = case when lower(coalesce(s.status,'')) = 'nonaktif'
                                 then 'STATUS NONAKTIF' else m.exclusion_reason end,
         last_evaluated_at = v_now
    from public.staff s
   where m.incident_id = p_incident_id
     and s.staff_id = m.staff_id
     and m.obligation_status <> 'EXCLUDED_NONACTIVE';

  select count(*),
         count(*) filter (where obligation_status = 'COMPLETED'),
         count(*) filter (where obligation_status = 'EXCLUDED_NONACTIVE'),
         count(*) filter (where obligation_status = 'PENDING')
    into v_total, v_completed, v_excluded, v_pending
    from public.lhi_discipline_snapshot_members
   where incident_id = p_incident_id;

  return jsonb_build_object('ok', true, 'total', v_total,
    'completed', v_completed, 'excluded_nonactive', v_excluded, 'pending', v_pending,
    'deadline_at', v_deadline, 'evaluated_at', v_now);
end;
$$;

revoke all on function public.lhi_track_employment_status_v3() from public, anon, authenticated;
revoke all on function public.lhi_refresh_grace_snapshot_v3(bigint) from public, anon, authenticated;
grant execute on function public.lhi_refresh_grace_snapshot_v3(bigint) to service_role;

-- Atomic open: validate the short-lived KA recovery session, snapshot each
-- unique staff member, clear discipline-only app blocks, and transition incident
-- plus global lock in one transaction. Employment status is never modified.
create or replace function public.open_lhi_global_grace_v3(p_recovery_session_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth jsonb;
  v_incident public.lhi_discipline_incidents%rowtype;
  v_now timestamptz := clock_timestamp();
  v_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('lhi_global_recovery_v3'));

  v_auth := public.validate_lhi_recovery_session(p_recovery_session_token_hash, 'apiStartLhiGrace');
  if coalesce((v_auth->>'ok')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'reason', 'RECOVERY_SESSION_INVALID');
  end if;

  select * into v_incident
    from public.lhi_discipline_incidents
   where incident_id = (v_auth->>'incident_id')::bigint
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'INCIDENT_NOT_FOUND');
  end if;

  if v_incident.status = 'GRACE' then
    return jsonb_build_object('ok', true, 'already_open', true,
      'incident_id', v_incident.incident_id,
      'started_at', v_incident.started_at, 'deadline_at', v_incident.deadline_at);
  end if;

  if v_incident.status <> 'LOCKED' then
    return jsonb_build_object('ok', false, 'reason', 'INCIDENT_NOT_LOCKED');
  end if;

  if not exists (
    select 1 from public.access_settings
     where key = 'LHI_GLOBAL_BLOCK' and value = 'AKTIF'
     for update
  ) then
    return jsonb_build_object('ok', false, 'reason', 'GLOBAL_LOCK_NOT_ACTIVE');
  end if;

  insert into public.lhi_discipline_snapshot_members(
    incident_id, staff_id, employment_status_at_snapshot, obligation_status, snapshot_at
  )
  select v_incident.incident_id, s.staff_id, s.status,
         case when lower(coalesce(s.status,'')) = 'nonaktif'
              then 'EXCLUDED_NONACTIVE' else 'PENDING' end,
         v_now
    from (
      select distinct staff_id
        from public.lhi_discipline_obligations
       where incident_id = v_incident.incident_id
    ) duties
    join public.staff s on s.staff_id = duties.staff_id
   where coalesce(s.role,'') <> 'KA_IPSRS'
  on conflict (incident_id, staff_id) do nothing;

  select count(*) into v_count
    from public.lhi_discipline_snapshot_members
   where incident_id = v_incident.incident_id;
  if v_count = 0 then
    raise exception 'Snapshot petugas kosong; pemulihan dibatalkan.';
  end if;

  update public.lhi_discipline_snapshot_members m
     set obligation_status = 'EXCLUDED_NONACTIVE',
         excluded_at = coalesce(excluded_at, v_now),
         exclusion_reason = 'STATUS NONAKTIF'
    from public.staff s
   where m.incident_id = v_incident.incident_id
     and s.staff_id = m.staff_id
     and lower(coalesce(s.status,'')) = 'nonaktif';

  update public.lhi_individual_access_blocks
     set active = false, cleared_at = v_now,
         cleared_by_staff_id = v_auth->>'staff_id',
         clear_reason = 'KA_IPSRS_GLOBAL_RECOVERY'
   where active = true
     and reason = 'LHI_NONCOMPLIANCE';

  update public.lhi_discipline_incidents
     set status = 'GRACE', started_at = v_now,
         deadline_at = v_now + interval '12 hours',
         started_by_staff_id = v_auth->>'staff_id',
         started_by_name = v_auth->>'staff_name',
         completed_at = null, reactivated_at = null
   where incident_id = v_incident.incident_id and status = 'LOCKED';

  if not found then
    raise exception 'Transisi insiden gagal; seluruh pemulihan dibatalkan.';
  end if;

  update public.access_settings
     set value = 'NONAKTIF', updated_at = v_now,
         updated_by_staff_id = v_auth->>'staff_id',
         updated_by_name = v_auth->>'staff_name'
   where key = 'LHI_GLOBAL_BLOCK' and value = 'AKTIF';
  if not found then
    raise exception 'Transisi blokir global gagal; seluruh pemulihan dibatalkan.';
  end if;

  insert into public.audit_log(
    username, staff_id, action, report_id, keterangan,
    field_changed, old_value, new_value
  ) values (
    v_auth->>'staff_id', v_auth->>'staff_id', 'OPEN_LHI_GLOBAL_GRACE_V3', null,
    'Pemulihan atomik oleh KA IPSRS; blokir aplikasi LHI dibuka dan kelonggaran 12 jam dimulai. Status kepegawaian tidak diubah.',
    'LHI_GLOBAL_BLOCK,lhi_individual_access_blocks,lhi_discipline_incidents.status',
    'AKTIF / LOCKED / BLOKIR INDIVIDUAL',
    'NONAKTIF / GRACE / BLOKIR INDIVIDUAL DIBUKA'
  );

  return jsonb_build_object('ok', true, 'already_open', false,
    'incident_id', v_incident.incident_id, 'status', 'GRACE',
    'started_at', v_now, 'deadline_at', v_now + interval '12 hours',
    'total', v_count);
end;
$$;

revoke all on function public.open_lhi_global_grace_v3(text) from public, anon, authenticated;
grant execute on function public.open_lhi_global_grace_v3(text) to service_role;

commit;
