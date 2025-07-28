#!/bin/bash

# Exit on any error
set -e

echo "🧹 Cleaning dist folders..."
find packages -name 'dist' -type d -exec rm -rf {} + 2>/dev/null || true
find packages -name 'tsconfig.tsbuildinfo' -type f -delete 2>/dev/null || true

echo "📦 Building packages..."

echo "  🔧 Building session-recorder-common..."
cd packages/session-recorder-common
npm run build
cd ../..

echo "  🌐 Building session-recorder-browser..."
cd packages/session-recorder-browser
npm run build
cd ../..

echo "  🖥️  Building session-recorder-node..."
cd packages/session-recorder-node
npm run build
cd ../..

echo "✅ All packages built successfully!"