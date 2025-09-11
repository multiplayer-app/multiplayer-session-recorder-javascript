import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import 'react-native-reanimated'

import { useColorScheme } from '@/hooks/use-color-scheme'
import { SessionRecorderProvider } from '@multiplayer-app/session-recorder-react-native'

export const unstable_settings = {
  anchor: '(tabs)'
}

const sessionRecorderOptions = {
  version: '0.0.1',
  application: 'react-native-app',
  environment: 'development',
  apiKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnRlZ3JhdGlvbiI6IjY4NGZlMDljMjA0NmYwYjM0ZjU5ZDNjYyIsIndvcmtzcGFjZSI6IjY4NGMzYmYwYjQ2MGUzMmY3YWJmZjRlMSIsInByb2plY3QiOiI2ODRjM2M0MmI0NjBlMzJmN2FiZmY1YzgiLCJ0eXBlIjoiT1RFTCIsImlhdCI6MTc1MDA2NTMwOH0.F15dW5RUHtq4-e2FUZD_vK0FJ5USs8SRFbnPYO_0XVk',
  apiBaseUrl: 'http://localhost',
  exporterEndpoint: 'http://localhost/v1/traces',
  showWidget: true,
  ignoreUrls: [
    /posthog\.com.*/,
    /https:\/\/bam\.nr-data\.net\/.*/,
    /https:\/\/cdn\.jsdelivr\.net\/.*/,
    /https:\/\/pixel\.source\.app\/.*/
  ],
  propagateTraceHeaderCorsUrls: new RegExp(`${process.env.REACT_APP_API_BASE_URL}\.*`, 'i'),
  sampleTraceRatio: 0.3,
  schemifyDocSpanPayload: true
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <SessionRecorderProvider options={sessionRecorderOptions}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name='(tabs)' options={{ headerShown: false }} />
          <Stack.Screen name='user/[id]' options={{ headerShown: false }} />
          <Stack.Screen name='user-posts/[id]' options={{ headerShown: false }} />
          <Stack.Screen name='modal' options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style='auto' />
      </ThemeProvider>
    </SessionRecorderProvider>
  )
}
