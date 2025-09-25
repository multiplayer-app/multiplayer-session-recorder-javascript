#!/bin/bash

# Exit on any error
set -e

# Configuration
SOURCE_DIR="./dist"
SOURCE_DIR_IOS="./ios"
SOURCE_DIR_ANDROID="./android"
TARGET_DIR_EXPO="./examples/example-app-expo/node_modules/@multiplayer-app/session-recorder-react-native"
TARGET_DIR_NATIVE="./examples/example-app/node_modules/@multiplayer-app/session-recorder-react-native"

echo "📱 Copying React Native dist to sample Expo app..."

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Source directory does not exist: $SOURCE_DIR"
    echo "💡 Please run 'npm run build' in the session-recorder-react-native package first"
    exit 1
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR_EXPO" ]; then
    echo "⚠️  Target directory does not exist: $TARGET_DIR_EXPO"
    echo "💡 Skipping script execution - please make sure the sample-expo-app is set up and has the package installed"
    exit 0
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR_NATIVE" ]; then
    echo "⚠️  Target directory does not exist: $TARGET_DIR_NATIVE"
    echo "💡 Skipping script execution - please make sure the example-app is set up and has the package installed"
    exit 0
fi

# Copy the dist and native folders
echo "🔄 Copying dist folder and native sources..."
cp -r "$SOURCE_DIR" "$TARGET_DIR_EXPO/"
cp -r "$SOURCE_DIR_IOS" "$TARGET_DIR_EXPO/"
cp -r "$SOURCE_DIR_ANDROID" "$TARGET_DIR_EXPO/"

cp -r "$SOURCE_DIR" "$TARGET_DIR_NATIVE/"
cp -r "$SOURCE_DIR_IOS" "$TARGET_DIR_NATIVE/"
cp -r "$SOURCE_DIR_ANDROID" "$TARGET_DIR_NATIVE/"

# Ensure RN autolinking config and metadata are in sync
echo "🛠️  Syncing react-native.config.js and package.json..."
cp -f "./react-native.config.js" "$TARGET_DIR_EXPO/react-native.config.js"
cp -f "./package.json" "$TARGET_DIR_EXPO/package.json"
cp -f "./react-native.config.js" "$TARGET_DIR_NATIVE/react-native.config.js"
cp -f "./package.json" "$TARGET_DIR_NATIVE/package.json"

echo "✅ Successfully synced package into sample Expo app."
echo "📍 Source: $(pwd)"
echo "📍 Target: $TARGET_DIR_EXPO"
echo "📍 Target: $TARGET_DIR_NATIVE"
