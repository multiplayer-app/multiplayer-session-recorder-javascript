#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting publish process..."

# echo "📦 Building all packages..."
# ./scripts/build.sh

echo "📤 Publishing packages..."

echo "  🔧 Publishing session-recorder-common..."
cd packages/session-recorder-common
npm publish
cd ../..

pnpm install

echo "  🌐 Publishing session-recorder-browser..."
cd packages/session-recorder-browser
npm publish
cd ../..

echo "  🖥️  Publishing session-recorder-node..."
cd packages/session-recorder-node
npm publish
cd ../..

echo "  🖥️  Publishing session-recorder-react..."
cd packages/session-recorder-react
npm publish
cd ../..

echo "  🖥️  Publishing session-recorder-react-native..."
cd packages/session-recorder-react-native
yarn
npm publish
cd ../..


echo "✅ All packages published successfully!"