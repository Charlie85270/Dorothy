#!/bin/bash
# Set SUID bit on chrome-sandbox for Electron's sandbox to work.
# Required for Chromium's SUID sandbox on Linux (avoids --no-sandbox).
# Idempotent: safe to run multiple times.
chown root:root /opt/Dorothy/chrome-sandbox
chmod 4755 /opt/Dorothy/chrome-sandbox

# Warn if SUID bit didn't stick (e.g. /opt mounted with nosuid)
if [ ! -u /opt/Dorothy/chrome-sandbox ]; then
  echo "WARNING: Failed to set SUID bit on /opt/Dorothy/chrome-sandbox." >&2
  echo "If /opt is mounted with 'nosuid', the Electron sandbox will not work." >&2
  echo "You may need to run Dorothy with --no-sandbox as a workaround." >&2
fi
