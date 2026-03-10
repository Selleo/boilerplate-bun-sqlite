#!/bin/bash

set -e

BINARY=app
CONFIG=v1
ADDR=${ADDR:-todosshalias}

: "${TAG:?TAG env variable is required}"

echo "Initializing.."
ssh root@$ADDR "
    mkdir -p /app/api/$BINARY/config/$CONFIG /app/api/$BINARY/releases
    mkdir -p /app/api/$BINARY/data
    mkdir -p /app/api/$BINARY/scripts
    touch /app/api/$BINARY/config/$CONFIG/.env
"

echo "Building.."
make

echo "Deploying.."


RELEASE_DIR=/app/api/$BINARY/releases/$TAG

ssh root@$ADDR "
    mkdir -p $RELEASE_DIR
    ln -sfn /app/api/$BINARY/config/$CONFIG/.env $RELEASE_DIR/.env
    ln -sfn /app/api/$BINARY/data $RELEASE_DIR/data
"
if [ "$ADDR" = "internals" ]; then
    scp scripts/backup.sh root@$ADDR:/app/api/$BINARY/scripts/backup.sh
    scp scripts/crontab root@$ADDR:/etc/cron.d/$BINARY
    ssh root@$ADDR "chmod 644 /etc/cron.d/$BINARY"
fi

scp dist/$BINARY root@$ADDR:$RELEASE_DIR/$BINARY

ssh root@$ADDR "
    chmod +x $RELEASE_DIR/$BINARY &&
    ln -sfn $RELEASE_DIR /app/api/$BINARY/current
"

echo "Restarting.."

ssh root@$ADDR "
    systemctl restart $BINARY && journalctl -u $BINARY
"

echo "Ok"
