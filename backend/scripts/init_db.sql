-- Creates (or updates) the backend's database login and its schema, as the warehouse admin.
-- Run by the api-db-init service: psql -v api_password=... -f this file.
--
-- sikatrack_api owns `app` and nothing else: no access to the pipeline's dw schema or the
-- dashboard views. Read access to user-scoped warehouse views comes with phase 4.

SELECT 'CREATE ROLE sikatrack_api LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sikatrack_api') \gexec

-- Keeps the password in step with backend/.env when it changes
ALTER ROLE sikatrack_api WITH LOGIN PASSWORD :'api_password';

CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION sikatrack_api;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
