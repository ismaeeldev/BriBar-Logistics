-- Creates the isolated database the integration suite truncates.
--
-- Runs only on first initialisation of the volume. If the volume already
-- exists, create it by hand:
--   docker exec bribar-postgres psql -U bribar -d postgres -c "CREATE DATABASE bribar_test"
CREATE DATABASE bribar_test;
