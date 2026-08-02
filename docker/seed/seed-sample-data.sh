#!/usr/bin/env bash
set -euo pipefail

SEED_MARKER=/seed-status/.seeded

if [ -f "$SEED_MARKER" ]; then
  echo "Sample data already loaded (marker found). Skipping seed."
  exit 0
fi

echo "Installing curl and mongodb-database-tools..."
apt-get update -qq
apt-get install -y -qq curl mongodb-database-tools >/dev/null

ARCHIVE_PATH=/tmp/sampledata.archive
echo "Downloading MongoDB Atlas sample dataset archive..."
curl -sSL "https://atlas-education.s3.amazonaws.com/sampledata.archive" -o "$ARCHIVE_PATH"

echo "Restoring sample databases (sample_mflix, sample_airbnb, sample_restaurants, and more)..."
mongorestore --uri="$MONGO_URI" --archive="$ARCHIVE_PATH" --drop

touch "$SEED_MARKER"
echo "Sample data seeded successfully."
