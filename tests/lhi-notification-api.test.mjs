import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../frontend/app.js", import.meta.url), "utf8");
const api = await readFile(new URL("../supabase/functions/ipsrs-api/index.ts", import.meta.url), "utf8");
const notifications = await readFile(new URL("../frontend/lhi-discipline-notifications.js", import.meta.url), "utf8");

test("notification module receives the authenticated API wrapper and session reader", () => {
  assert.ok(app.includes("window.authRun = authRun;"));
  assert.ok(app.includes("window.getSession = getSession;"));
  assert.ok(notifications.includes("typeof window.authRun!=='function'"));
  assert.ok(notifications.includes("window.authRun('apiGetLhiNotifications')"));
});

test("authenticated transport sends notification reads and marks with the session token", () => {
  assert.ok(app.includes("case 'apiGetLhiNotifications':"));
  assert.ok(app.includes("case 'apiMarkLhiNotificationRead':"));
  assert.ok(app.includes("payload.notificationId=args[0]||0;"));
});

test("notification read endpoint is scoped to the authenticated staff recipient", () => {
  const start = api.indexOf('if(a==="apiGetLhiNotifications")');
  const end = api.indexOf('if(a==="apiGetReports")', start);
  assert.ok(start > 0 && end > start);
  const section = api.slice(start, end);
  assert.ok(section.includes('.eq("recipient_staff_id",s.staff_id)'));
  assert.ok(section.includes('.is("read_at",null)'));
  assert.ok(section.includes('.order("created_at",{ascending:false})'));
  assert.ok(section.includes('if(a==="apiMarkLhiNotificationRead")'));
  assert.ok(section.includes('.eq("notification_id",id)'));
  assert.ok(section.includes('.eq("recipient_staff_id",s.staff_id)'));
  assert.ok(section.includes('.is("read_at",null)'));
  assert.ok(section.includes('Number.isSafeInteger(id)'));
  assert.ok(!section.includes('d.staff_id'));
});

test("notification frontend marks only the unread rows returned by its own endpoint", () => {
  assert.ok(notifications.includes("const unread=rows.filter(x=>!x.read_at)"));
  assert.ok(notifications.includes("window.authRun('apiMarkLhiNotificationRead',Number(row.notification_id))"));
});
