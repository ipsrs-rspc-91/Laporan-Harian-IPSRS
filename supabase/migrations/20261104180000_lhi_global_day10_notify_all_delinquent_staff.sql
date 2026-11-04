DO $migration$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.run_lhi_discipline_scheduler()'::regprocedure)
  INTO v_def;

  v_old := '  v_message text;' || E'\n';
  v_new := '  v_message text;' || E'\n' || '  v_trigger_names text;' || E'\n';
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'Declaration anchor not found in run_lhi_discipline_scheduler';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  v_old := '        insert into public.audit_log(username,staff_id,action,report_id,keterangan,field_changed,old_value,new_value)' || E'\n' ||
'        values(''SYSTEM'',v_staff.staff_id,''ACTIVATE_LHI_GLOBAL_BLOCK_DAY_10'',null,' || E'\n' ||
'          ''Mode Blok Aplikasi global diaktifkan karena ''||v_staff.nama||'' mencapai 10 hari kalender tanpa LHI. Snapshot kewajiban dibuat dengan tenggat kelonggaran 5 hari (120 jam).'',' || E'\n' ||
'          ''LHI_GLOBAL_BLOCK'',''NONAKTIF'',''AKTIF'');';
  v_new := '        SELECT string_agg(s.nama, '', '' ORDER BY s.nama)' || E'\n' ||
'        INTO v_trigger_names' || E'\n' ||
'        FROM public.staff s' || E'\n' ||
'        WHERE coalesce(s.role, '''') <> ''KA_IPSRS''' || E'\n' ||
'          AND s.status IN (''Aktif'',''Nonaktif_LHI_HARI_8'')' || E'\n' ||
'          AND NOT EXISTS (' || E'\n' ||
'            SELECT 1 FROM generate_series(0,9) d(day_offset)' || E'\n' ||
'            WHERE EXISTS (' || E'\n' ||
'              SELECT 1 FROM public.reports r' || E'\n' ||
'              WHERE r.staff_id=s.staff_id' || E'\n' ||
'                AND (r.created_at AT TIME ZONE ''Asia/Jakarta'')::date=(v_today-d.day_offset::integer)' || E'\n' ||
'                AND r.created_at >= coalesce(s.lhi_discipline_reset_at,s.created_at)' || E'\n' ||
'                AND r.deleted_at IS NULL' || E'\n' ||
'            )' || E'\n' ||
'          );' || E'\n' ||
'        v_trigger_names := coalesce(v_trigger_names, v_staff.nama);' || E'\n' ||
'        insert into public.audit_log(username,staff_id,action,report_id,keterangan,field_changed,old_value,new_value)' || E'\n' ||
'        values(''SYSTEM'',v_staff.staff_id,''ACTIVATE_LHI_GLOBAL_BLOCK_DAY_10'',null,' || E'\n' ||
'          ''Mode Blok Aplikasi global diaktifkan karena petugas berikut mencapai 10 hari kalender tanpa LHI: ''||v_trigger_names||''. Snapshot kewajiban dibuat dengan tenggat kelonggaran 5 hari (120 jam).'',' || E'\n' ||
'          ''LHI_GLOBAL_BLOCK'',''NONAKTIF'',''AKTIF'');';
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'Day-10 audit anchor not found';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  v_old := '          ''Mode Blok Aplikasi aktif karena ''||v_staff.nama||'' tidak mengisi LHI selama 10 hari kalender berturut-turut. Hanya KA IPSRS yang dapat masuk melalui Reset.''';
  v_new := '          ''Mode Blok Aplikasi aktif karena petugas berikut tidak mengisi LHI selama 10 hari kalender berturut-turut: ''||v_trigger_names||''. Hanya KA IPSRS yang dapat masuk melalui Reset.''';
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'Day-10 notification anchor not found';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  EXECUTE v_def;
END
$migration$;
