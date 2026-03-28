#!/bin/bash
# Set SUID bit on chrome-sandbox for Electron's sandbox to work.
# Required for Chromium's SUID sandbox on Linux (avoids --no-sandbox).
# Idempotent: safe to run multiple times.
chown root:root /opt/Dorothy/chrome-sandbox
chmod 4755 /opt/Dorothy/chrome-sandbox
