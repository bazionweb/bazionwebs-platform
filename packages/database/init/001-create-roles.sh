#!/usr/bin/env bash
set -euo pipefail

# Runs once when PostgreSQL initializes an empty local volume.
# The superuser is only for local database administration; applications use
# separate least-privilege logins created below.
psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=app_password="$BAZION_APP_PASSWORD" \
  --set=migrator_password="$BAZION_MIGRATOR_PASSWORD" <<'SQL'
CREATE ROLE bazion_app
  LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

CREATE ROLE bazion_migrator
  LOGIN PASSWORD :'migrator_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS;

GRANT CONNECT ON DATABASE bazion_platform TO bazion_app, bazion_migrator;
GRANT USAGE ON SCHEMA public TO bazion_app;
GRANT USAGE, CREATE ON SCHEMA public TO bazion_migrator;

-- Runtime permissions are granted explicitly by reviewed migrations. This
-- avoids accidentally exposing a newly added table to the application role.
SQL
