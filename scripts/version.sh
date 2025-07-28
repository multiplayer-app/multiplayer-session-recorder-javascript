#!/bin/bash

# Exit on any error
set -e

echo "🔢 Incrementing patch versions..."

echo "  🔧 Versioning session-recorder-common..."
cd packages/session-recorder-common
npm version patch --no-git-tag-version --ignore-scripts
cd ../..

echo "  🌐 Versioning session-recorder-browser..."
cd packages/session-recorder-browser
npm version patch --no-git-tag-version --ignore-scripts
cd ../..

echo "  🖥️  Versioning session-recorder-node..."
cd packages/session-recorder-node
npm version patch --no-git-tag-version --ignore-scripts
cd ../..

echo "✅ All packages versioned successfully!"