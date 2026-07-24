-- Run after restoring a Supabase dump that still uses auth.users and RLS.
-- Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- public.users (mirror of auth.users for plain Postgres)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_sign_in_at timestamptz
);

DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    last_sign_in_at
  )
  SELECT
    u.id,
    COALESCE(NULLIF(trim(u.email), ''), u.id::text || '@import.local'),
    u.encrypted_password,
    u.email_confirmed_at,
    COALESCE(u.raw_user_meta_data, '{}'::jsonb),
    u.created_at,
    u.updated_at,
    u.last_sign_in_at
  FROM auth.users u
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = EXCLUDED.updated_at,
    last_sign_in_at = EXCLUDED.last_sign_in_at;
END $$;

-- ---------------------------------------------------------------------------
-- Repoint FK constraints from auth.users -> public.users
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  col_list text;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT
      c.conname,
      n.nspname AS schema_name,
      cl.relname AS table_name,
      c.conrelid,
      c.conkey
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY u.ord)
    INTO col_list
    FROM unnest(r.conkey) WITH ORDINALITY AS u(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = r.conrelid AND a.attnum = u.attnum;

    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      r.schema_name,
      r.table_name,
      r.conname
    );
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.users(id)',
      r.schema_name,
      r.table_name,
      r.conname,
      col_list
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Profile trigger on public.users (not auth.users)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
  END IF;
END $$;

DROP TRIGGER IF EXISTS on_public_user_created ON public.users;
CREATE TRIGGER on_public_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Strip RLS on public schema
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  END LOOP;
END $$;
