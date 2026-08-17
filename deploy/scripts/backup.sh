#!/usr/bin/env bash
set -euo pipefail

umask 077

backup_dir=/var/backups/dictionary
timestamp=$(date -u +%Y-%m-%dT%H%M%SZ)

install -d -m 0700 -o postgres -g postgres "$backup_dir"
runuser -u postgres -- pg_dump --format=custom --file="$backup_dir/dictionary-$timestamp.dump" dictionary
find "$backup_dir" -type f -name 'dictionary-*.dump' -mtime +14 -delete
