-- Drop units.unit_status (#177, ADR 0005, release 2).
--
-- Release 1 (20261027300000) left nothing that reads or writes the column.

BEGIN;

DROP INDEX public.idx_units_status;

ALTER TABLE public.units
    DROP CONSTRAINT units_unit_status_check,
    DROP COLUMN unit_status;

COMMIT;
