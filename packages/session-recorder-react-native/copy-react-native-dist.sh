#!/bin/bash

# Exit on any error
set -e

# Configuration
SOURCE_DIR="./dist"
SOURCE_DIR_IOS="./ios"
SOURCE_DIR_ANDROID="./android"
TARGET_DIR="./examples/example-app-expo/node_modules/@multiplayer-app/session-recorder-react-native"

echo "📱 Copying React Native dist to sample Expo app..."

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Source directory does not exist: $SOURCE_DIR"
    echo "💡 Please run 'npm run build' in the session-recorder-react-native package first"
    exit 1
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "⚠️  Target directory does not exist: $TARGET_DIR"
    echo "💡 Skipping script execution - please make sure the sample-expo-app is set up and has the package installed"
    exit 0
fi

# Copy the dist and native folders
echo "🔄 Copying dist folder and native sources..."
cp -r "$SOURCE_DIR" "$TARGET_DIR/"
cp -r "$SOURCE_DIR_IOS" "$TARGET_DIR/"
cp -r "$SOURCE_DIR_ANDROID" "$TARGET_DIR/"

# Ensure RN autolinking config and metadata are in sync
echo "🛠️  Syncing react-native.config.js and package.json..."
cp -f "./react-native.config.js" "$TARGET_DIR/react-native.config.js"
cp -f "./package.json" "$TARGET_DIR/package.json"

echo "✅ Successfully synced package into sample Expo app."
echo "📍 Source: $(pwd)"
echo "📍 Target: $TARGET_DIR"
