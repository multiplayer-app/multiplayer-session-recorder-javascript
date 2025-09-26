/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  SessionRecorderProvider,
  SessionRecorder,
} from '@multiplayer-app/session-recorder-react-native';
import { useEffect, useRef } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';

SessionRecorder.init({
  version: '0.0.1',
  application: 'react-native-app',
  environment: 'development',
  apiKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnRlZ3JhdGlvbiI6IjY4Y2E4MTc1ZDIzYTRmODBmNDljNWRiZSIsIndvcmtzcGFjZSI6IjY0OTFjMmU5OGExYTIyMTM2MzM0MzRiYyIsInByb2plY3QiOiI2OGMzY2FhOTU1MGM5YjkwNTgxMmM1ZDYiLCJ0eXBlIjoiT1RFTCIsImlhdCI6MTc1ODEwMTg3N30.CXWrtmwqQ3MsKxBpBOqKHNpS6orj_lOeHEltebZZMII',
  recordScreen: true,
  recordGestures: true,
  recordNavigation: true,
});

function App() {
  const navigationRef = useRef<any>(null);
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    // Set session attributes
    SessionRecorder.setSessionAttributes({
      userName: 'John Doe',
      userEmail: 'john.doe@example.com',
      userId: '12345',
    });
  }, []);

  return (
    <SessionRecorderProvider>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            SessionRecorder.setNavigationRef(navigationRef.current);
          }}
          theme={isDarkMode ? DarkTheme : DefaultTheme}
        >
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </SessionRecorderProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
