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

# Copy the dist folder
echo "🔄 Copying dist folder..."
cp -r "$SOURCE_DIR" "$TARGET_DIR/"
cp -r "$SOURCE_DIR_IOS" "$TARGET_DIR/"
cp -r "$SOURCE_DIR_ANDROID" "$TARGET_DIR/"


echo "✅ Successfully copied dist folder to sample Expo app!"
echo "📍 Source: $SOURCE_DIR"
echo "📍 Target: $TARGET_DIR/dist"
