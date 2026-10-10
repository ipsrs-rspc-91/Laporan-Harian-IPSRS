-- Rename existing Kitchen/Dapur area to M.E. (Kitchen), preserving ID 44, child items, and reports.
-- Rollback: UPDATE public.master_data SET name='KITCHEN /DAPUR', updated_at=now() WHERE id=44 AND data_type='AREA' AND name='M.E. (Kitchen)';
do $$
declare changed integer;
begin
  update public.master_data
  set name = 'M.E. (Kitchen)', updated_at = now()
  where id = 44 and data_type = 'AREA' and is_active = true and name = 'KITCHEN /DAPUR';
  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'Expected exactly one active area ID 44 named KITCHEN /DAPUR; updated % rows. Transaction rolled back.', changed;
  end if;
end $$;
