#!/bin/bash
set -e

# macOS (built here)
bun build src/index.tsx --compile --target=bun-darwin-arm64 --outfile dist/multiplayer-darwin-arm64 --sourcemap=none
bun build src/index.tsx --compile --target=bun-darwin-x64   --outfile dist/multiplayer-darwin-x64   --sourcemap=none

# Linux — requires @opentui/core-linux-x64 / core-linux-arm64 installed
# Run this on a Linux CI runner with those packages available
bun build src/index.tsx --compile --target=bun-linux-x64    --outfile dist/multiplayer-linux-x64    --sourcemap=none
bun build src/index.tsx --compile --target=bun-linux-arm64  --outfile dist/multiplayer-linux-arm64  --sourcemap=none
