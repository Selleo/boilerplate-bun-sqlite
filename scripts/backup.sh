#!/usr/bin/env bash

set -a
source /app/api/TODO/config/backup.env
set +a

SRC="/app/api/TODO/data/app.sqlite"

YEAR=$(date +%Y)
MONTH=$(date +%m)
NAME="TODO-$(date +%Y-%m-%d-%H%M).sqlite"

DEST="$BACKUP_BUCKET/backups/TODO/$YEAR/$MONTH/$NAME"

AWS_ACCESS_KEY_ID="$BACKUP_KEY" AWS_SECRET_ACCESS_KEY="$BACKUP_SECRET" aws s3 cp "$SRC" "s3://$DEST" --endpoint-url "$BACKUP_ENDPOINT"
