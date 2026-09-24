-- Align direct authenticated UPDATE RLS with the same edit authority
-- used by the backend, while keeping report ownership immutable.

create or replace function private.prevent_report_owner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.staff_id is distinct from old.staff_id then
    raise exception 'staff_id laporan tidak boleh diubah.';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_report_owner_change() from public, anon, authenticated;

drop trigger if exists trg_reports_immutable_staff_id on public.reports;
create trigger trg_reports_immutable_staff_id
before update of staff_id on public.reports
for each row execute function private.prevent_report_owner_change();

alter policy reports_update_authorized
on public.reports
with check (
  (select private.can_edit_report(staff_id, role_snapshot))
);