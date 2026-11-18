ALTER TABLE public.hkm_members
  ADD COLUMN IF NOT EXISTS title varchar(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS department varchar(120) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gender varchar(24) NOT NULL DEFAULT 'Male',
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_transform jsonb,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS occupation varchar(160),
  ADD COLUMN IF NOT EXISTS marital_status varchar(24),
  ADD COLUMN IF NOT EXISTS joined_at date;

ALTER TABLE public.hkm_members DROP CONSTRAINT IF EXISTS hkm_members_status_check;
ALTER TABLE public.hkm_members ADD CONSTRAINT hkm_members_status_check
  CHECK (status IN ('active', 'inactive', 'transferred', 'pending_fee'));
