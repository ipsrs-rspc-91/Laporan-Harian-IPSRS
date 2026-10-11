-- Harden trigger functions against mutable search_path resolution.
-- Function bodies and trigger behavior are intentionally unchanged.
ALTER FUNCTION public.prevent_duplicate_master_item() SET search_path = '';
ALTER FUNCTION public.prevent_kategori_master_mutation() SET search_path = '';
ALTER FUNCTION public.enforce_final_report_kategori() SET search_path = '';
