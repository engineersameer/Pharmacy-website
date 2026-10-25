#!/usr/bin/env bash
# Local development database: a private Postgres 16 on port 5434, stored in .pgdata/.
# It does not touch any other Postgres or Docker on this machine.
#   ./scripts/db.sh start | stop | status
set -euo pipefail
cd "$(dirname "$0")/.."
PG=/opt/homebrew/opt/postgresql@16/bin
export LC_ALL=en_US.UTF-8   # Postgres refuses to start on macOS without a locale
DATA=.pgdata
PORT=5434

case "${1:-status}" in
  start)  "$PG/pg_ctl" -D "$DATA" -l "$DATA/server.log" -o "-p $PORT -k /tmp" -w start ;;
  stop)   "$PG/pg_ctl" -D "$DATA" -w stop ;;
  status) "$PG/pg_ctl" -D "$DATA" status ;;
  *) echo "usage: $0 start|stop|status"; exit 1 ;;
esac
