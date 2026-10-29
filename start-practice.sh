#!/bin/sh
# Loads the practice workflows (wired to the mock GHL server) into n8n, then starts n8n.
# Run `node mock-ghl-server.js` in another terminal first. Safe to re-run.
set -e
cd "$(dirname "$0")"
npx -y n8n import:credentials --input=practice/credentials.json
npx -y n8n import:workflow --input=practice/workflows.json
npx -y n8n publish:workflow --id=practiceError001
npx -y n8n publish:workflow --id=practiceLead0001
npx -y n8n start
