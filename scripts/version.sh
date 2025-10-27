#!/bin/bash

# Exit on any error
set -e

echo "🔢 Incrementing patch versions..."

echo "  🔧 Versioning session-recorder-common..."
cd packages/session-recorder-common
npm version patch --no-git-tag-version --ignore-scripts
COMMON_VERSION=$(node -p "require('./package.json').version")
cd ../..

echo "  🌐 Versioning session-recorder-browser..."
cd packages/session-recorder-browser
npm version patch --no-git-tag-version --ignore-scripts
# Update devDependencies
sed -i '' "s/\"@multiplayer-app\/session-recorder-common\": \"[^\"]*\"/\"@multiplayer-app\/session-recorder-common\": \"$COMMON_VERSION\"/" package.json
cd ../..

echo "  🖥️  Versioning session-recorder-node..."
cd packages/session-recorder-node
npm version patch --no-git-tag-version --ignore-scripts
# Update dependencies
sed -i '' "s/\"@multiplayer-app\/session-recorder-common\": \"[^\"]*\"/\"@multiplayer-app\/session-recorder-common\": \"$COMMON_VERSION\"/" package.json
cd ../..

echo "  📱 Versioning session-recorder-react-native..."
cd packages/session-recorder-react-native
npm version patch --no-git-tag-version --ignore-scripts
# Update dependencies
sed -i '' "s/\"@multiplayer-app\/session-recorder-common\": \"[^\"]*\"/\"@multiplayer-app\/session-recorder-common\": \"$COMMON_VERSION\"/" package.json
cd ../..

echo "✅ All packages versioned and dependencies updated successfully!"