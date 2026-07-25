-- Performance: every single-column foreign key in `public` that lacks a
-- covering index gets one. Without it, FK lookups and cascade/joins fall back
-- to sequential scans. Idempotent (CREATE INDEX IF NOT EXISTS + skips FKs that
-- already have a leading-column index). Tables are small at trial scale, so a
-- brief plain CREATE INDEX lock is fine.
DO $$
DECLARE
  r record;
  idx_name text;
BEGIN
  FOR r IN
    SELECT cl.relname AS tbl_name,
           a.attname  AS col_name
    FROM pg_constraint c
    JOIN pg_class cl     ON cl.oid = c.conrelid
    JOIN pg_namespace n  ON n.oid = cl.relnamespace
    JOIN pg_attribute a  ON a.attrelid = c.conrelid AND a.attnum = (c.conkey)[1]
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND array_length(c.conkey, 1) = 1
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND i.indkey[0] = (c.conkey)[1]
      )
  LOOP
    idx_name := left('idx_' || r.tbl_name || '_' || r.col_name, 63);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
                   idx_name, r.tbl_name, r.col_name);
    RAISE NOTICE 'created index % on %(%)', idx_name, r.tbl_name, r.col_name;
  END LOOP;
END $$;
