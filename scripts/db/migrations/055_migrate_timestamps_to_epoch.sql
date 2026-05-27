-- migration 055_migrate_timestamps_to_epoch.sql
DO $$
DECLARE
    r RECORD;
    sql TEXT;
BEGIN
    FOR r IN 
        SELECT table_name, column_name, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name <> 'schema_migrations'
          AND data_type IN ('timestamp without time zone', 'timestamp with time zone')
    LOOP
        RAISE NOTICE 'Migrating table: %, column: %, default: %', r.table_name, r.column_name, r.column_default;

        -- If there is a default constraint, we drop it first
        IF r.column_default IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', r.table_name, r.column_name);
        END IF;

        -- Alter column type to bigint converting old timestamp to epoch milliseconds
        sql := format('ALTER TABLE %I ALTER COLUMN %I TYPE bigint USING (extract(epoch from %I) * 1000)::bigint', 
                      r.table_name, r.column_name, r.column_name);
        EXECUTE sql;

        -- If it originally had a default value, set the epoch millisecond equivalent as default
        IF r.column_default IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT (extract(epoch from now()) * 1000)::bigint', 
                           r.table_name, r.column_name);
        END IF;
    END LOOP;
END $$;
