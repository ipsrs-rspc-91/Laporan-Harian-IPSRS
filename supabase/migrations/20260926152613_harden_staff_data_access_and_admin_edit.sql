-- AUDIT TOTAL 2026-09-26
-- 1) public.staff is only consumed through the authenticated Edge API/service role.
--    Prevent direct Data API access to sensitive staff columns from browser clients.
-- 2) Business rule: Administrasi IPSRS may edit staff reports, except KA IPSRS.

revoke all on table public.staff from anon, authenticated;

drop policy if exists authenticated_read_staff on public.staff;

update public.access_settings
set value='AKTIF',
    updated_at=now(),
    updated_by_staff_id='SYSTEM',
    updated_by_name='AUDIT TOTAL 2026-09-26'
where key='ADMINISTRASI_EDIT';

insert into public.access_settings(key,value,updated_at,updated_by_staff_id,updated_by_name)
select 'ADMINISTRASI_EDIT','AKTIF',now(),'SYSTEM','AUDIT TOTAL 2026-09-26'
where not exists (
  select 1 from public.access_settings where key='ADMINISTRASI_EDIT'
);
