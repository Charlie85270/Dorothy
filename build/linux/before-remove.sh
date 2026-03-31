#!/bin/bash
# Remove SUID bit from chrome-sandbox before package removal.
# Ensures no world-executable SUID root binary is left behind.
if [ -f /opt/Dorothy/chrome-sandbox ]; then
  chmod 0755 /opt/Dorothy/chrome-sandbox
fi
