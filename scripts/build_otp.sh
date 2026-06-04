#!/bin/bash
set -e

echo "STARTING OTP SERVER"

# Go to script directory so paths are consistent
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "Project root: $(pwd)"

DATA_DIR="data"

echo "Checking GTFS + OSM data..."
ls -lh "$DATA_DIR"

echo ""
echo "Java version:"
java -version

echo ""
echo "Finding OTP jar..."

OTP_JAR=$(find . -maxdepth 3 -name "*shaded*.jar" | head -n 1)

if [ -z "$OTP_JAR" ]; then
  echo "ERROR: OTP jar not found!"
  echo "Make sure otp-2.5.0-shaded.jar is in the project directory"
  exit 1
fi

echo "Using OTP JAR: $OTP_JAR"

echo ""
echo "Starting OTP (build + serve)..."

java -Xmx6G -jar "$OTP_JAR" \
  --build "$DATA_DIR" \
  --serve