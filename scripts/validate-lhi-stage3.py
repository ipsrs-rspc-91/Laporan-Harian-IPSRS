from pathlib import Path
from pglast import parse_sql

root = Path(".")
migration_paths = [
    root / "supabase/migrations/20261102150000_lhi_recovery_token_gate_stage2.sql",
    root / "supabase/migrations/20261102170000_lhi_created_at_monitoring_stage3.sql",
]
for path in migration_paths:
    sql = path.read_text(encoding="utf-8")
    parse_sql(sql)
    print(f"PASS PostgreSQL outer syntax: {path}")

stage3 = migration_paths[1].read_text(encoding="utf-8")
api = (root / "supabase/functions/ipsrs-api/index.ts").read_text(encoding="utf-8")

required_sql = [
    "AT TIME ZONE 'Asia/Jakarta'",
    "ARRAY[4,6,7]",
    "v_days >= 8",
    "v_days >= 10",
    "obligation_status = 'EXCLUDED_NONACTIVE'",
    "lhi_obligation_audit",
    "staff_employment_status_history",
    "LEGACY_REPORT_REACTIVATION_INFERRED",
    "LEGACY_MANUAL_UNBLOCK_AUDIT",
    "LEGACY_REACTIVATION_UNKNOWN_REVIEW_REQUIRED",
    "run_lhi_daily_monitoring",
    "'0 17 * * *'",
]
for token in required_sql:
    assert token in stage3, f"Missing Stage 3 SQL invariant: {token}"

assert "r.tanggal" not in stage3, "Stage 3 scheduler must not use work/event date"
assert "SET status = 'DIBLOKIR_LHI_7_HARI'" not in stage3
assert "SET status = 'Nonaktif_LHI_HARI_8'" not in stage3
assert "OLD.deleted_at IS NULL" in stage3 and "NEW.deleted_at IS NOT NULL" in stage3

staff_start = api.index("async function staff(")
staff_end = api.index("\nasync function hashRecoveryToken", staff_start)
staff_fn = api[staff_start:staff_end]
assert 'from("reports")' not in staff_fn, "Login gate must not use reports.tanggal"
assert 'from("lhi_staff_monitoring_state")' in staff_fn
assert "wibDate(" in staff_fn
assert "status kepegawaian tetap aktif" in staff_fn.lower()

act_start = api.index("async function act(")
act_end = api.index("\nexport default", act_start)
act_fn = api[act_start:act_end]
assert 'rpc("run_lhi_discipline_scheduler")' in act_fn
assert "deadline_at" in act_fn and "getTime()<=Date.now()" in act_fn

monitoring_checks = [
    ('if(a==="apiGetStaffMonitoring"){', 'if(a==="apiGetStaffDailyStatus"){'),
    ('if(a==="apiGetStaffDailyStatus"){', 'if(a==="apiGetMonthlyRecap"){'),
    ('if(a==="apiGetMonthlyRecap"){', 'if(a==="apiDashboardStats"){'),
]
for start, end in monitoring_checks:
    section = api[api.index(start):api.index(end, api.index(start) + len(start))]
    assert 'created_at' in section, f"{start} must use created_at"
    assert "wibDate(" in section, f"{start} must group by WIB input date"
    assert "active_since" in section and "addWibDays(" in section, f"{start} must honor the employee activation baseline"
    assert "wajib_hari_ini" in section or start.startswith('if(a==="apiGetStaffDailyStatus"'), f"{start} must expose daily due status"

dashboard_start = api.index("const monitoringStart=")
dashboard_end = api.index("const sortCount=", dashboard_start)
dashboard_monitoring = api[dashboard_start:dashboard_end]
assert "created_at" in dashboard_monitoring and "wibDate(" in dashboard_monitoring
assert "active_since" in dashboard_monitoring and "addWibDays(" in dashboard_monitoring
assert "wajib_hari_ini" in dashboard_monitoring
assert "r.tanggal" not in dashboard_monitoring

print("PASS Stage 3 semantic regression guards")
print("NOTE PL/pgSQL function bodies are stored as strings in CREATE FUNCTION; this parser checks outer PostgreSQL syntax only.")
