import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('LHI compliance date is derived from valid created_at in WIB, not work date', async () => {
  const sql = await read('../../supabase/migrations/20261103120000_lhi_discipline_employment_access_separation.sql');
  expect(sql).toContain("r.created_at AT TIME ZONE 'Asia/Jakarta'");
  expect(sql).toContain('r.created_at >= v_staff.lhi_monitoring_since');
  expect(sql).toContain('r.deleted_at IS NULL');
  expect(sql).not.toMatch(/r\.tanggal\s*=/i);
});

test('calendar-day thresholds follow warning 4/6/7, individual block 8, global block 10', async () => {
  const sql = await read('../../supabase/migrations/20261103120000_lhi_discipline_employment_access_separation.sql');
  expect(sql).toContain('IF v_days IN (4,6,7)');
  expect(sql).toContain('IF v_days >= 8');
  expect(sql).toContain('IF v_days >= 10');

  const daysWithout = (anchor, today) => Math.max(0,
    Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(anchor + 'T00:00:00Z')) / 86400000) - 1
  );
  expect(daysWithout('2026-10-22', '2026-10-26')).toBe(3);
  expect(daysWithout('2026-10-22', '2026-10-27')).toBe(4);
  expect(daysWithout('2026-10-22', '2026-10-29')).toBe(6);
  expect(daysWithout('2026-10-22', '2026-10-30')).toBe(7);
  expect(daysWithout('2026-10-22', '2026-10-31')).toBe(8);
  expect(daysWithout('2026-10-22', '2026-11-02')).toBe(10);
});

test('employment status is not used as an LHI application-block flag', async () => {
  const sql = await read('../../supabase/migrations/20261103120000_lhi_discipline_employment_access_separation.sql');
  const api = await read('../../supabase/functions/ipsrs-api/index.ts');
  expect(sql).toContain('lhi_access_blocked boolean NOT NULL DEFAULT false');
  expect(sql).toContain("SET lhi_access_blocked = true");
  expect(sql).toContain("status = 'Aktif'");
  expect(sql).not.toContain("SET status = 'Nonaktif_LHI_HARI_8'");
  expect(api).toContain('data.lhi_access_blocked===true');
  expect(api).toContain('Employment status and application access are independent.');
  expect(api).not.toContain('DIBLOKIR_LHI_7_HARI');
});

test('global lock is enforced by backend and only recovery actions are allowed in recovery mode', async () => {
  const api = await read('../../supabase/functions/ipsrs-api/index.ts');
  expect(api).toContain('MODE FORM BLOK APLIKASI AKTIF. Semua akses operasional ditutup');
  expect(api).toContain('const recoveryAllowed=["apiWhoAmI","apiGetAccessControl","apiGetLhiGraceStatus","apiStartLhiGrace","apiLogout"]');
  expect(api).toContain('if(recoveryMode && !recoveryAllowed.includes(a))');
});

test('Reset issues a server proof token and binds it to an authenticated KA IPSRS', async () => {
  const reset = await read('../../supabase/functions/lhi-reset-verify/index.ts');
  const api = await read('../../supabase/functions/ipsrs-api/index.ts');
  expect(reset).toContain('recovery_token: recoveryToken');
  expect(reset).toContain('lhi_recovery_tokens');
  expect(reset).toContain('expires_at');
  expect(api).toContain('redeemed_by_auth_user_id');
  expect(api).toContain('identity.role!=="KA_IPSRS"');
  expect(api).toContain('Perintah pemulihan wajib menggunakan sesi Reset terbatas KA IPSRS.');
});

test('12-hour snapshot obligations are completed by one valid report and excluded for nonactive staff', async () => {
  const sql = await read('../../supabase/migrations/20261103120000_lhi_discipline_employment_access_separation.sql');
  expect(sql).toContain("obligation_status = 'EXCLUDED'");
  expect(sql).toContain("'DIKECUALIKAN — STATUS NONAKTIF'");
  expect(sql).toContain("obligation_status = 'COMPLETED'");
  expect(sql).toContain("r.created_at >= i.started_at");
  expect(sql).toContain("r.created_at < i.deadline_at");
  expect(sql).toContain('IF now() >= v_deadline');
});

test('discipline event history is append-only and notifications are idempotent', async () => {
  const sql = await read('../../supabase/migrations/20261103120000_lhi_discipline_employment_access_separation.sql');
  expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.lhi_discipline_events');
  expect(sql).toContain('reject_lhi_event_mutation');
  expect(sql).toContain('BEFORE UPDATE OR DELETE ON public.lhi_discipline_events');
  expect(sql).toContain('ON CONFLICT(event_key,recipient_staff_id) DO NOTHING');
});

test('frontend carries the recovery proof and renders only the recovery access panel', async () => {
  const app = await read('../../frontend/app.js');
  const access = await read('../../frontend/access-control.js');
  expect(app).toContain('IPSRS_LHI_RECOVERY_TOKEN');
  expect(app).toContain('payload.recoveryToken');
  expect(app).toContain('CURRENT_SESSION.recovery_mode');
  expect(access).toContain('session.recovery_mode');
  expect(access).toContain('__ipsrsCompleteLhiRecovery');
});
