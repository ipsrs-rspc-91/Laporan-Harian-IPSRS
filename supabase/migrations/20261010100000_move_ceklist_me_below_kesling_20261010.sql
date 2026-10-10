-- Move CEK LIST M.E. / UTILITI directly below Kesling and before M.E. (Kitchen).
-- Preserve all area/item IDs and report history.
-- Rollback: restore sort_order from pre-change audit record.
do $$
declare changed integer;
begin
  update public.master_data set sort_order = sort_order + 1, updated_at = now()
  where data_type='AREA' and is_active=true and sort_order >= 32 and id <> 45;
  update public.master_data set sort_order = 32, updated_at = now()
  where id=45 and data_type='AREA' and is_active=true and name='CEK LIST M.E. / UTILITI';
  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'Expected exactly one CEK LIST M.E. / UTILITI area ID 45; updated % rows. Transaction rolled back.', changed;
  end if;
end $$;
