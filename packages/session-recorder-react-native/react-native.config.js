module.exports = {
  dependencies: {
    '@multiplayer-app/session-recorder-react-native': {
      platforms: {
        android: {
          sourceDir: './android',
          packageImportPath: 'import com.multiplayer.sessionrecorder.SessionRecorderPackage;'
        },
        ios: {
          podspecPath: './SessionRecorderNative.podspec'
        }
      }
    }
  }
}
