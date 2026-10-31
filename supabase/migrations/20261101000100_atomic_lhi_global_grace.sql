-- Atomic transition from global LHI lock to the 12-hour grace window.
create or replace function public.open_lhi_global_block_grace(
  p_staff_id text,
  p_staff_name text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_current text;
  v_incident public.lhi_discipline_incidents%rowtype;
  v_now timestamptz := now();
  v_deadline timestamptz := now() + interval '12 hours';
begin
  select role into v_role from public.staff
  where staff_id = p_staff_id for update;
  if v_role is distinct from 'KA_IPSRS' then
    return jsonb_build_object('ok', false, 'msg', 'Hanya KA IPSRS yang dapat membuka kelonggaran.');
  end if;

  select value into v_current from public.access_settings
  where key = 'LHI_GLOBAL_BLOCK' for update;
  if coalesce(upper(v_current), 'NONAKTIF') <> 'AKTIF' then
    return jsonb_build_object('ok', false, 'msg', 'Mode blok tidak sedang aktif.');
  end if;

  select * into v_incident from public.lhi_discipline_incidents
  where status in ('LOCKED', 'EXPIRED')
  order by incident_id desc limit 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'msg', 'Data insiden blokir tidak ditemukan.');
  end if;

  update public.lhi_discipline_incidents
  set status='GRACE', started_at=v_now, deadline_at=v_deadline,
      started_by_staff_id=p_staff_id, started_by_name=p_staff_name,
      completed_at=null, reactivated_at=null
  where incident_id=v_incident.incident_id;

  update public.access_settings
  set value='NONAKTIF', updated_at=v_now,
      updated_by_staff_id=p_staff_id, updated_by_name=p_staff_name
  where key='LHI_GLOBAL_BLOCK';

  insert into public.audit_log(username,staff_id,action,report_id,keterangan,field_changed,old_value,new_value)
  values(p_staff_id,p_staff_id,'OPEN_LHI_GLOBAL_BLOCK_GRACE',null,
    'KA IPSRS membuka kelonggaran 12 jam untuk pemenuhan kewajiban LHI.',
    'LHI_GLOBAL_BLOCK','AKTIF','NONAKTIF; tenggat '||v_deadline::text);

  return jsonb_build_object('ok',true,'data',jsonb_build_object(
    'incident_id',v_incident.incident_id,'started_at',v_now,'deadline_at',v_deadline
  ));
end;
$$;
revoke all on function public.open_lhi_global_block_grace(text,text) from public, anon, authenticated;
grant execute on function public.open_lhi_global_block_grace(text,text) to service_role;
