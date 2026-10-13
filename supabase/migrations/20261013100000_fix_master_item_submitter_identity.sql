-- Ensure new item review records retain the verified staff attribution.
create or replace function public.queue_new_master_item_for_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_area text;
  v_staff_id text;
  v_staff_name text;
  v_staff_role text;
begin
  if new.data_type <> 'ITEM' or new.is_active is not true then
    return new;
  end if;

  select name into v_area
  from public.master_data
  where id = new.parent_id and data_type = 'AREA';

  if new.created_by is not null then
    select staff_id, nama, role
      into v_staff_id, v_staff_name, v_staff_role
    from public.staff
    where auth_user_id = new.created_by
    order by case when status = 'Aktif' then 0 else 1 end
    limit 1;
  end if;

  insert into public.master_item_review_queue
    (master_data_id, item_name, area_name, submitted_by_staff_id, submitted_by_name, submitted_by_role)
  values
    (new.id, new.name, coalesce(v_area, '(area tidak ditemukan)'), v_staff_id, v_staff_name, v_staff_role)
  on conflict (master_data_id) do nothing;

  return new;
end;
$$;

-- Backfill attribution only when the master item's creator maps to a staff account.
update public.master_item_review_queue q
set submitted_by_staff_id = s.staff_id,
    submitted_by_name = s.nama,
    submitted_by_role = s.role,
    updated_at = now()
from public.master_data m
join public.staff s on s.auth_user_id = m.created_by
where q.master_data_id = m.id
  and (q.submitted_by_staff_id is null or q.submitted_by_name is null or q.submitted_by_role is null);
