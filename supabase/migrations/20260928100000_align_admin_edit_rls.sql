-- Align direct authenticated UPDATE RLS with backend ADMINISTRASI_EDIT policy.
-- KA IPSRS remains unrestricted; KA IPSRS-owned reports remain private/non-editable
-- for non-KA users; delegated permissions remain target-specific.

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
  admin_edit text;
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

  if myrole = 'ADMINISTRASI' then
    select upper(value) into admin_edit
    from public.access_settings
    where key = 'ADMINISTRASI_EDIT';
    return coalesce(admin_edit,'NONAKTIF') = 'AKTIF';
  end if;

  return exists(
    select 1
    from public.edit_permissions ep
    where ep.granted_to_staff_id = me
      and ep.target_staff_id = p_staff_id
      and ep.is_active = true
  );
end;
$function$;
