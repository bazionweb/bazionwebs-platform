#!/usr/bin/env bash
set -euo pipefail
umask 077

usage() {
  echo "Usage: $0 <container-label> <database-name> <database-user> <output-directory>" >&2
  exit 64
}

[[ $# -eq 4 ]] || usage
target_label="$1"
database_name="$2"
database_user="$3"
output_directory="$4"

for value in "$target_label" "$database_name" "$database_user"; do
  [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$ ]] || usage
done
[[ "$output_directory" = /* ]] || usage

mapfile -t containers < <(
  docker ps --quiet --filter "status=running" --filter "label=com.bazion.backup-target=$target_label"
)
if [[ ${#containers[@]} -ne 1 ]]; then
  echo "Expected one running PostgreSQL container with com.bazion.backup-target=$target_label; found ${#containers[@]}." >&2
  exit 1
fi
container_id="${containers[0]}"

install -d -m 0700 -- "$output_directory"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_path="$output_directory/${target_label}-${timestamp}.dump"
temporary_path="${dump_path}.tmp.$$"
trap 'rm -f -- "$temporary_path"' EXIT

# Custom-format pg_dump is transaction-consistent and compressed. The dump runs
# inside the database container over its local socket, so no DB port or password
# is exposed to the host process. Validate the archive directory before keeping it.
docker exec "$container_id" pg_dump \
  --no-owner \
  --no-acl \
  --format=custom \
  --username="$database_user" \
  --dbname="$database_name" > "$temporary_path"
[[ -s "$temporary_path" ]] || { echo "PostgreSQL dump is empty." >&2; exit 1; }
docker exec --interactive "$container_id" pg_restore --list - < "$temporary_path" > /dev/null
chmod 0600 -- "$temporary_path"
mv -- "$temporary_path" "$dump_path"
trap - EXIT
echo "Created and validated PostgreSQL dump: $dump_path"
