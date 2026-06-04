#!/bin/bash
set -e

echo "🚀 Starting OTP server"

# go to project root (adjust if needed)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

DATA_DIR="data"

echo "📂 Checking data folder..."
ls -lh "$DATA_DIR"

echo "☕ Java version:"
java -version

echo "🔎 Finding OTP jar..."

OTP_JAR=$(find . -maxdepth 3 -name "otp-2.5.0-shaded.jar" | head -n 1)

if [ -z "$OTP_JAR" ]; then
  echo "❌ OTP jar not found"
  exit 1
fi

echo "✅ Using: $OTP_JAR"

echo "🧹 Cleaning old graph (optional)"
rm -rf "$DATA_DIR/graph" || true

echo "⚙️ Building + starting OTP server..."

java -Xmx6G -jar "$OTP_JAR" \
  --build "$DATA_DIR" \
  --serve \
  --port 8080

echo "✅ OTP running at http://localhost:8080"