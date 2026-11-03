REVOKE ALL PRIVILEGES ON TABLE
  public.lhi_discipline_incidents,
  public.lhi_discipline_notifications,
  public.lhi_discipline_obligations
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE
  public.lhi_discipline_incidents,
  public.lhi_discipline_notifications,
  public.lhi_discipline_obligations
TO service_role;
