-- Creates (or updates) the login Metabase uses to read the warehouse.
-- Run by the metabase-reader-init service: psql -v reader_password=... -f this file.
-- The role only belongs to mart_reader, so it can read the mart views and nothing else.

SELECT 'CREATE ROLE mart_reader NOLOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mart_reader') \gexec

SELECT format('CREATE ROLE metabase_reader LOGIN PASSWORD %L', :'reader_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'metabase_reader') \gexec

-- Keeps the password in step with .env when it's changed
ALTER ROLE metabase_reader WITH LOGIN PASSWORD :'reader_password';
GRANT mart_reader TO metabase_reader;
