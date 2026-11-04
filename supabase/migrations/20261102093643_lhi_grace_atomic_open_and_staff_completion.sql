-- Atomic KA IPSRS recovery action: a failure leaves both global and individual LHI blocks unchanged.
CREATE OR REPLACE FUNCTION public.open_lhi_global_grace(
  p_staff_id text,
  p_staff_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_lock text;
  v_incident public.lhi_discipline_incidents%ROWTYPE;
  v_total integer := 0;
  v_reactivated integer := 0;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT value INTO v_lock
  FROM public.access_settings
  WHERE key = 'LHI_GLOBAL_BLOCK'
  FOR UPDATE;

  IF v_lock IS DISTINCT FROM 'AKTIF' THEN
    SELECT * INTO v_incident
    FROM public.lhi_discipline_incidents
    WHERE status = 'GRACE'
    ORDER BY incident_id DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND AND v_lock = 'NONAKTIF' THEN
      SELECT count(DISTINCT staff_id) INTO v_total
      FROM public.lhi_discipline_obligations
      WHERE incident_id = v_incident.incident_id;
      RETURN jsonb_build_object(
        'ok', true,
        'already_open', true,
        'incident_id', v_incident.incident_id,
        'status', v_incident.status,
        'started_at', v_incident.started_at,
        'deadline_at', v_incident.deadline_at,
        'total', v_total
      );
    END IF;

    RAISE EXCEPTION 'Mode Blok Aplikasi tidak dalam kondisi terkunci. Periksa status aplikasi sebelum mencoba kembali.';
  END IF;

  SELECT * INTO v_incident
  FROM public.lhi_discipline_incidents
  WHERE status = 'LOCKED'
  ORDER BY incident_id DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data insiden blokir global tidak ditemukan. Blokir tetap aktif dan tidak ada akun yang diubah.';
  END IF;

  SELECT count(DISTINCT staff_id) INTO v_total
  FROM public.lhi_discipline_obligations
  WHERE incident_id = v_incident.incident_id
    AND completed_at IS NULL;

  IF v_total < 1 THEN
    RAISE EXCEPTION 'Snapshot kewajiban petugas tidak ditemukan. Blokir tetap aktif dan tidak ada akun yang diubah.';
  END IF;

  UPDATE public.staff
  SET status = 'Aktif',
      lhi_manual_unblock_until = NULL,
      updated_at = v_now
  WHERE status IN ('Nonaktif_LHI_HARI_8', 'DIBLOKIR_LHI_7_HARI');

  GET DIAGNOSTICS v_reactivated = ROW_COUNT;

  UPDATE public.lhi_discipline_incidents
  SET status = 'GRACE',
      started_at = v_now,
      deadline_at = v_now + interval '100 hours',
      started_by_staff_id = p_staff_id,
      started_by_name = p_staff_name,
      completed_at = NULL,
      reactivated_at = NULL
  WHERE incident_id = v_incident.incident_id;

  UPDATE public.access_settings
  SET value = 'NONAKTIF',
      updated_at = v_now,
      updated_by_staff_id = p_staff_id,
      updated_by_name = p_staff_name
  WHERE key = 'LHI_GLOBAL_BLOCK';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status blokir global gagal diperbarui. Seluruh perubahan dibatalkan.';
  END IF;

  INSERT INTO public.audit_log(
    username, staff_id, action, report_id, keterangan,
    field_changed, old_value, new_value
  ) VALUES (
    p_staff_id, p_staff_id, 'OPEN_LHI_GLOBAL_GRACE', NULL,
    'KA IPSRS berhasil membuka blokir global dan seluruh blokir individual LHI secara bersamaan serta memulai kelonggaran 100 jam.',
    'LHI_GLOBAL_BLOCK,staff.status,lhi_discipline_incidents.status',
    'AKTIF / LOCKED / Nonaktif_LHI_HARI_8',
    'NONAKTIF / GRACE / Aktif'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_open', false,
    'incident_id', v_incident.incident_id,
    'status', 'GRACE',
    'started_at', v_now,
    'deadline_at', v_now + interval '100 hours',
    'total', v_total,
    'reactivated_accounts', v_reactivated
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.open_lhi_global_grace(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_lhi_global_grace(text, text) TO service_role;

-- Keep the 12-hour grace window open until its deadline, freeze its snapshot,
-- and count one valid report saved during the window for each snapshot-listed staff member.
DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.run_lhi_discipline_scheduler()'::regprocedure)
  INTO v_definition;

  v_old := E'if v_active_grace is not null then\n    select count(*) into v_pending';
  v_new := E'if v_active_grace is not null then\n    update public.lhi_discipline_obligations o\n    set completed_at = NULL\n    where o.incident_id = v_active_grace\n      and o.completed_at is not null\n      and not exists (\n        select 1\n        from public.lhi_discipline_incidents i\n        join public.reports r on r.staff_id = o.staff_id\n        where i.incident_id = o.incident_id\n          and i.status = ''GRACE''\n          and r.deleted_at is null\n          and r.created_at >= i.started_at\n          and r.created_at < i.deadline_at\n      );\n    update public.lhi_discipline_obligations o\n    set completed_at = now()\n    where o.incident_id = v_active_grace\n      and o.completed_at is null\n      and exists (\n        select 1\n        from public.lhi_discipline_incidents i\n        join public.reports r on r.staff_id = o.staff_id\n        where i.incident_id = o.incident_id\n          and i.status = ''GRACE''\n          and r.deleted_at is null\n          and r.created_at >= i.started_at\n          and r.created_at < i.deadline_at\n      );\n    select count(*) into v_pending';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Patch scheduler gagal: titik evaluasi kelonggaran tidak ditemukan.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := 'if v_pending = 0 then';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Patch scheduler gagal: kondisi penyelesaian snapshot tidak ditemukan.';
  END IF;
  v_definition := replace(v_definition, v_old, 'if now() >= v_deadline and v_pending = 0 then');

  v_old := 'if v_days=8 and v_staff.status=''Aktif'' then';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Patch scheduler gagal: kondisi blokir individual hari ke-8 tidak ditemukan.';
  END IF;
  v_definition := replace(v_definition, v_old, 'if v_days=8 and v_staff.status=''Aktif'' and v_active_grace is null then');

  v_old := E'select incident_id into v_incident\n  from public.lhi_discipline_incidents\n  where status in (''GRACE'',''LOCKED'')\n  order by incident_id desc\n  limit 1;';
  v_new := E'select incident_id into v_incident\n  from public.lhi_discipline_incidents\n  where status = ''LOCKED''\n  order by incident_id desc\n  limit 1;';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Patch scheduler gagal: bagian perluasan snapshot tidak ditemukan.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'  update public.lhi_discipline_obligations o\n  set completed_at=now()\n  where o.completed_at is null\n    and exists(select 1 from public.reports r\n      where r.staff_id=o.staff_id and r.tanggal=o.required_date and r.deleted_at is null);';
  v_new := E'  update public.lhi_discipline_obligations o\n  set completed_at=now()\n  where o.completed_at is null\n    and exists(select 1 from public.lhi_discipline_incidents i\n      join public.reports r on r.staff_id=o.staff_id\n      where i.incident_id=o.incident_id and i.status=''GRACE''\n        and r.created_at >= i.started_at and r.created_at < i.deadline_at\n        and r.deleted_at is null);';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Patch scheduler gagal: aturan pemenuhan LHI selama kelonggaran tidak ditemukan.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END;
$migration$;
