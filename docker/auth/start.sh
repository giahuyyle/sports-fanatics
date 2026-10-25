#!/bin/sh
set -eu
# Demo project only: this container must never write to a real Firebase project.
set --
if [ -f /data/export/firebase-export-metadata.json ]; then
  set -- --import=/data/export
fi
exec firebase emulators:start --only auth --project demo-sports-fanatics \
  --config /emulator/firebase.json --export-on-exit=/data/export "$@"
