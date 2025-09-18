import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import 'react-native-reanimated'

import { useColorScheme } from '@/hooks/use-color-scheme'
import { SessionRecorderProvider, SessionRecorder } from '@multiplayer-app/session-recorder-react-native'

export const unstable_settings = {
  anchor: '(tabs)'
}
//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnRlZ3JhdGlvbiI6IjY4YzNjYjE4NTk1NTcwNjMwYzI0NWJkNCIsIndvcmtzcGFjZSI6IjY0OTFjMmU5OGExYTIyMTM2MzM0MzRiYyIsInByb2plY3QiOiI2OGMzY2FhOTU1MGM5YjkwNTgxMmM1ZDYiLCJ0eXBlIjoiT1RFTCIsImlhdCI6MTc1NzY2MTk3Nn0.u4jruzv_zEL9fQMSv748So29OvR5M_itEENb57Yga2c

const sessionRecorderOptions = {
  version: '0.0.1',
  application: 'react-native-app',
  environment: 'development',
  apiKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnRlZ3JhdGlvbiI6IjY4Y2E4MTc1ZDIzYTRmODBmNDljNWRiZSIsIndvcmtzcGFjZSI6IjY0OTFjMmU5OGExYTIyMTM2MzM0MzRiYyIsInByb2plY3QiOiI2OGMzY2FhOTU1MGM5YjkwNTgxMmM1ZDYiLCJ0eXBlIjoiT1RFTCIsImlhdCI6MTc1ODEwMTg3N30.CXWrtmwqQ3MsKxBpBOqKHNpS6orj_lOeHEltebZZMII',
  showWidget: true,
  masking: {
    enabled: false,
    maskTextInputs: false,
    maskSandboxedViews: false
  }
}

SessionRecorder.setSessionAttributes({
  userName: 'Gegham Khachatryan',
  userId: '12345'
})

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <SessionRecorderProvider options={sessionRecorderOptions}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name='(tabs)' options={{ headerShown: false }} />
          <Stack.Screen name='user/[id]' options={{ headerShown: false }} />
          <Stack.Screen name='user-posts/[id]' options={{ headerShown: false }} />
          <Stack.Screen name='post/[id]' options={{ headerShown: false }} />
          <Stack.Screen name='modal' options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style='auto' />
      </ThemeProvider>
    </SessionRecorderProvider>
  )
}
