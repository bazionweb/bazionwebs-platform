-- GMFC is a church/ministry tenant. Keep optional commerce out of its admin
-- workspace unless a platform operator explicitly enables it later.
INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
SELECT id, 'commerce', false, 'system:gmfc-baseline'
FROM public.tenants
WHERE slug = 'global-mission-fc'
ON CONFLICT (tenant_id, module_id) DO UPDATE
SET enabled = EXCLUDED.enabled,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
