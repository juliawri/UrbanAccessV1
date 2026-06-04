#!/bin/bash
set -e

echo "STARTING OTP 2.5 SERVER"

# Go to project root (adjust if needed)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "Project root: $(pwd)"

DATA_DIR="data"

echo "Checking GTFS + OSM data..."
ls -lh "$DATA_DIR"


echo "Java version:"
java -version


echo "Finding OTP 2.5 jar..."

OTP_JAR=$(find . -maxdepth 3 -name "otp-2.5.0-shaded.jar" | head -n 1)

if [ -z "$OTP_JAR" ]; then
  echo " ERROR: otp-2.5.0-shaded.jar not found!"
  exit 1
fi

echo "Using OTP JAR: $OTP_JAR"

echo "Cleaning old graph (optional but recommended)..."
rm -rf "$DATA_DIR/graph" || true


echo "Building graph + starting server..."

java -Xmx6G -jar "$OTP_JAR" \
  --build "$DATA_DIR" \
  --server \
  --port 8080


echo "OTP is running!"
echo "Test: http://localhost:8080/otp/routers"
echo "Plan: http://localhost:8080/otp/routers/default/plan"