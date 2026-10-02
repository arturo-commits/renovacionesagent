#!/bin/sh
# Copia consistente de la base de datos SQLite (válida con la BD en uso) y rotación de 30 días.
set -eu
DB="${DATABASE_PATH:-/data/tuio-academy.db}"
DIR="${BACKUP_DIR:-/data/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
mkdir -p "$DIR"
FILE="$DIR/tuio-academy-$(date +%Y%m%d-%H%M%S).db"
sqlite3 "$DB" ".backup '$FILE'"
sqlite3 "$FILE" "PRAGMA integrity_check;" | grep -q '^ok$'
gzip "$FILE"
find "$DIR" -name 'tuio-academy-*.db.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Iseconds) copia creada: $FILE.gz"
