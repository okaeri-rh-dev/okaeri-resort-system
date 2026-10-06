-- Read-only role for the weekly prod drift check (scripts/drift-check.sh).
-- Created without login or password so no secret lives in the repo. On prod, enable it by hand:
--   alter role drift_reader login password '<generated>';
-- The catalog queries need no table privileges; only the migration history is granted.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'drift_reader') then
    create role drift_reader nologin;
  end if;
end $$;

alter role drift_reader set default_transaction_read_only = on;

-- Without usage, search_path skips extensions and defaults deparse as extensions.uuid_generate_v4().
grant usage on schema extensions to drift_reader;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    grant usage on schema supabase_migrations to drift_reader;
    grant select on supabase_migrations.schema_migrations to drift_reader;
  end if;
end $$;
