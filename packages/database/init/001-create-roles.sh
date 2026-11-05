#!/usr/bin/env bash
set -euo pipefail

# Runs once when PostgreSQL initializes an empty local volume.
# The database superuser is for administration and migrations only.
psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=app_password="$BAZION_APP_PASSWORD" \
  --set=migrator_password="$BAZION_MIGRATOR_PASSWORD" \
  --set=auth_password="$BAZION_AUTH_PASSWORD" \
  --set=resolver_password="$BAZION_TENANT_RESOLVER_PASSWORD" \
  --set=provisioner_password="$BAZION_TENANT_PROVISIONER_PASSWORD" <<'SQL'
CREATE ROLE bazion_app
  LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

CREATE ROLE bazion_migrator
  LOGIN PASSWORD :'migrator_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS;

CREATE ROLE bazion_auth_runtime
  LOGIN PASSWORD :'auth_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

CREATE ROLE bazion_tenant_resolver
  LOGIN PASSWORD :'resolver_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

CREATE ROLE bazion_tenant_provisioner
  LOGIN PASSWORD :'provisioner_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

GRANT CONNECT ON DATABASE bazion_platform
  TO bazion_app, bazion_migrator, bazion_auth_runtime,
     bazion_tenant_resolver, bazion_tenant_provisioner;

GRANT USAGE ON SCHEMA public TO bazion_app, bazion_tenant_resolver, bazion_tenant_provisioner;
GRANT USAGE, CREATE ON SCHEMA public TO bazion_migrator;

-- Better Auth gets a dedicated schema. Its runtime role receives DML only;
-- all schema/table creation runs with the migration role.
CREATE SCHEMA auth AUTHORIZATION bazion_migrator;
GRANT USAGE ON SCHEMA auth TO bazion_auth_runtime;
GRANT USAGE, CREATE ON SCHEMA auth TO bazion_migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE bazion_migrator IN SCHEMA auth
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bazion_auth_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE bazion_migrator IN SCHEMA auth
  GRANT USAGE, SELECT ON SEQUENCES TO bazion_auth_runtime;

-- Business table permissions are granted explicitly by numbered migrations.
SQL
