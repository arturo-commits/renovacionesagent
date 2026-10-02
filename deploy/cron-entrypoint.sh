#!/bin/sh
# Contenedor de tareas programadas (recordatorios y copias de seguridad).
set -eu
apk add --no-cache curl sqlite tzdata >/dev/null
# crond no garantiza que las tareas hereden las variables del contenedor: se guardan en /etc/cron.env.
: > /etc/cron.env
for v in CRON_SECRET APP_INTERNAL_URL DATABASE_PATH BACKUP_DIR BACKUP_KEEP_DAYS TZ; do
  eval "val=\${$v-}"
  [ -n "$val" ] && printf "export %s='%s'\n" "$v" "$(printf %s "$val" | sed "s/'/'\\\\''/g")" >> /etc/cron.env
done
chmod 600 /etc/cron.env
exec crond -f -l 8
