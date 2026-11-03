#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
node ../scripts/prepare_ios_links.js
node ../scripts/export_ios.js
xcodegen generate
