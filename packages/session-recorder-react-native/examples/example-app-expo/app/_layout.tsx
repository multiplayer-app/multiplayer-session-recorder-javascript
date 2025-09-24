import { Stack, useNavigationContainerRef } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import 'react-native-reanimated'

import { useColorScheme } from '@/hooks/use-color-scheme'
import { SessionRecorderProvider, SessionRecorder } from '@multiplayer-app/session-recorder-react-native'
import { useEffect } from 'react'

export const unstable_settings = {
  anchor: '(tabs)'
}

SessionRecorder.init({
  version: '0.0.1',
  application: 'react-native-app',
  environment: 'development',
  apiKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnRlZ3JhdGlvbiI6IjY4Y2E4MTc1ZDIzYTRmODBmNDljNWRiZSIsIndvcmtzcGFjZSI6IjY0OTFjMmU5OGExYTIyMTM2MzM0MzRiYyIsInByb2plY3QiOiI2OGMzY2FhOTU1MGM5YjkwNTgxMmM1ZDYiLCJ0eXBlIjoiT1RFTCIsImlhdCI6MTc1ODEwMTg3N30.CXWrtmwqQ3MsKxBpBOqKHNpS6orj_lOeHEltebZZMII'
})

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const navigationRef = useNavigationContainerRef()

  useEffect(() => {
    const unsubscribe = navigationRef.addListener?.('state', () => {
      // After the first state event, the ref is valid
      SessionRecorder.setNavigationRef(navigationRef)
      // You can unsubscribe after the first time if you prefer
      unsubscribe?.()
    })
    return unsubscribe
  }, [navigationRef])

  useEffect(() => {
    // Set session attributes
    SessionRecorder.setSessionAttributes({
      userName: 'John Doe',
      userEmail: 'john.doe@example.com',
      userId: '12345'
    })
  }, [])

  return (
    <SessionRecorderProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name='(tabs)' options={{ headerShown: false }} />
          <Stack.Screen name='user/[id]' options={{ headerShown: false }} />
          <Stack.Screen name='user-posts/[id]' options={{ headerShown: false }} />
          <Stack.Screen name='post/[id]' options={{ headerShown: false }} />
          <Stack.Screen name='modal' options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
        <StatusBar style='auto' />
      </ThemeProvider>
    </SessionRecorderProvider>
  )
}
