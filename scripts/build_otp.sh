#!/bin/bash
set -e

echo "BUILDING OTP GRAPH"

cd "$(dirname "$0")/.."

OTP_JAR=$(find . -maxdepth 3 -name "*shaded*.jar" | head -n 1)

DATA_DIR="data"

java -Xmx6G -jar "$OTP_JAR" \
  --build "$DATA_DIR" \
  --save "$DATA_DIR"