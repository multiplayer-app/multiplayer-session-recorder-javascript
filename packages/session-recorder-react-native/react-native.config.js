module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath:
          'import com.sessionrecordernative.SessionRecorderNativePackage;',
      },
      ios: {
        podspecPath: './SessionRecorderNative.podspec',
      },
    },
  },
};
