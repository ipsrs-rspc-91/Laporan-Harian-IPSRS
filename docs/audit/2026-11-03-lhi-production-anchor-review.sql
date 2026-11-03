-- READ-ONLY PRODUCTION PREFLIGHT.
-- This query does not write or alter any production data.
-- Review the proposed lhi_active_since anchor against HR employment/activation
-- history before enabling the v2 scheduler. staff.created_at is only a
-- provisional fallback; it is not proof of the employee's employment start.
WITH active_staff AS (
  SELECT
    s.staff_id,
    s.nama,
    s.role,
    s.status,
    s.created_at AS provisional_lhi_active_since
  FROM public.staff s
  WHERE s.status = 'Aktif'
),
latest_valid_lhi AS (
  SELECT
    s.staff_id,
    max(r.created_at) FILTER (
      WHERE r.deleted_at IS NULL
        AND r.created_at >= s.provisional_lhi_active_since
    ) AS latest_valid_lhi_created_at
  FROM active_staff s
  LEFT JOIN public.reports r ON r.staff_id = s.staff_id
  GROUP BY s.staff_id
)
SELECT
  s.staff_id,
  s.nama,
  s.role,
  s.status,
  s.provisional_lhi_active_since,
  (s.provisional_lhi_active_since AT TIME ZONE 'Asia/Jakarta')::date
    AS provisional_active_since_wib_date,
  l.latest_valid_lhi_created_at,
  COALESCE(l.latest_valid_lhi_created_at, s.provisional_lhi_active_since)
    AS provisional_scheduler_anchor,
  CASE
    WHEN l.latest_valid_lhi_created_at IS NULL
      THEN 'HR_CONFIRMATION_REQUIRED_NO_VALID_LHI'
    ELSE 'HR_CONFIRMATION_REQUIRED_CREATED_AT_IS_PROVISIONAL'
  END AS review_status
FROM active_staff s
LEFT JOIN latest_valid_lhi l USING (staff_id)
ORDER BY s.role, s.nama, s.staff_id;

-- Confirm there are no current legacy LHI markers left after the migration
-- plan has been reviewed. Before migration, this query shows which rows will
-- be normalized to status='Aktif' while retaining BLOCKED_LHI.
SELECT status, count(*) AS total
FROM public.staff
WHERE status IN ('Nonaktif_LHI_HARI_8', 'DIBLOKIR_LHI_7_HARI')
GROUP BY status
ORDER BY status;

-- Verify the current global lock and active incident count before cutover.
SELECT
  (SELECT value FROM public.access_settings WHERE key = 'LHI_GLOBAL_BLOCK')
    AS lhi_global_block,
  (SELECT count(*) FROM public.lhi_discipline_incidents
   WHERE status IN ('LOCKED', 'GRACE')) AS active_incident_count;
