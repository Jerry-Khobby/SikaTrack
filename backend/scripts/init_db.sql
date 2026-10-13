-- Creates (or updates) the backend's database login and its schema, as the warehouse admin.
-- Run by the api-db-init service: psql -v api_password=... -f this file.
--
-- sikatrack_api owns `app`, and reads the warehouse only through the user-scoped `api` views
-- (warehouse migration 006), via the api_reader role. It has no access to dw's tables.

SELECT 'CREATE ROLE sikatrack_api LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sikatrack_api') \gexec

-- Keeps the password in step with backend/.env when it changes
ALTER ROLE sikatrack_api WITH LOGIN PASSWORD :'api_password';

CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION sikatrack_api;
REVOKE ALL ON SCHEMA app FROM PUBLIC;

-- Read access to the warehouse's API views (the role is created by migration 006, or here first)
SELECT 'CREATE ROLE api_reader NOLOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'api_reader') \gexec
GRANT api_reader TO sikatrack_api;

