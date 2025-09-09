#!/bin/bash

# Exit on any error
set -e

# Configuration
SOURCE_DIR="./dist"
TARGET_DIR="../../../sample-expo-app/node_modules/@multiplayer-app/session-recorder-react-native"

echo "📱 Copying React Native dist to sample Expo app..."

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Source directory does not exist: $SOURCE_DIR"
    echo "💡 Please run 'npm run build' in the session-recorder-react-native package first"
    exit 1
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ Target directory does not exist: $TARGET_DIR"
    echo "💡 Please make sure the sample-expo-app is set up and has the package installed"
    exit 1
fi

# Create backup of existing dist if it exists
if [ -d "$TARGET_DIR/dist" ]; then
    echo "📦 Creating backup of existing dist..."
    cp -r "$TARGET_DIR/dist" "$TARGET_DIR/dist.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Copy the dist folder
echo "🔄 Copying dist folder..."
cp -r "$SOURCE_DIR" "$TARGET_DIR/"

echo "✅ Successfully copied dist folder to sample Expo app!"
echo "📍 Source: $SOURCE_DIR"
echo "📍 Target: $TARGET_DIR/dist"
