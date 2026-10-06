-- One line per object in the public schema, so local (migrations) and prod can be diffed.
-- Reads pg_catalog plus the migration history: works for the drift_reader role.
-- Long definitions (function bodies, view SQL, policy expressions) are md5-hashed.
-- Deparsed defaults qualify schemas missing from search_path, so pin it for every role.
set search_path = public, extensions;

with ext_objects as (
  select objid from pg_depend where deptype = 'e'
),
rels as (
  select c.oid, c.relname, c.relkind, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
    and c.oid not in (select objid from ext_objects)
)
select line from (
  select format('relation %s kind=%s rls=%s', relname, relkind, relrowsecurity) as line
  from rels

  union all
  select format('column %s.%s %s%s%s', r.relname, a.attname,
    format_type(a.atttypid, a.atttypmod),
    case when a.attnotnull then ' not null' else '' end,
    coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), ''))
  from rels r
  join pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = r.oid and d.adnum = a.attnum

  union all
  select format('view %s md5=%s', relname, md5(pg_get_viewdef(oid)))
  from rels where relkind in ('v', 'm')

  union all
  -- CHECK casts and parens are stripped: tables created on an older Postgres deparse
  -- `IN (...)` as `ANY ((ARRAY[...])::text[])` instead of `ANY (ARRAY[(...)::text])`.
  select format('constraint %s.%s %s', r.relname, con.conname,
    case when con.contype = 'c'
      then regexp_replace(regexp_replace(pg_get_constraintdef(con.oid),
        '::(character varying|text)(\[\])?', '', 'g'), '[()]', '', 'g')
      else pg_get_constraintdef(con.oid)
    end)
  from rels r
  join pg_constraint con on con.conrelid = r.oid

  union all
  select format('index %s', pg_get_indexdef(i.indexrelid))
  from rels r
  join pg_index i on i.indrelid = r.oid

  union all
  select format('trigger %s', pg_get_triggerdef(t.oid))
  from rels r
  join pg_trigger t on t.tgrelid = r.oid and not t.tgisinternal

  union all
  select format('policy %s.%s %s roles=%s md5=%s', r.relname, p.polname, p.polcmd,
    (select string_agg(coalesce(rol.rolname, 'public'), ',' order by rol.rolname)
       from unnest(p.polroles) as pr(oid) left join pg_roles rol on rol.oid = pr.oid),
    md5(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || '|' ||
        coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')))
  from rels r
  join pg_policy p on p.polrelid = r.oid

  union all
  select format('function %s(%s) returns %s md5=%s', p.proname,
    pg_get_function_identity_arguments(p.oid),
    pg_get_function_result(p.oid),
    md5(pg_get_functiondef(p.oid)))
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
    and p.oid not in (select objid from ext_objects)

  union all
  select 'migration ' || version from supabase_migrations.schema_migrations

  union all
  select format('enum %s %s', t.typname,
    (select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid))
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typtype = 'e'
) fingerprint
order by line;
