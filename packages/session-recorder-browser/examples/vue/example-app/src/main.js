import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import SessionRecorder from '@multiplayer-app/session-recorder-browser'

// Initialize Multiplayer Session Recorder before creating the Vue app (Quick Start)
SessionRecorder.init({
  version: '0.0.1',
  apiKey: 'YOUR_API_KEY',
  environment: 'production',
  application: 'vue-example',
  propagateTraceHeaderCorsUrls: [
    // new RegExp('https://your.backend.api.domain', 'i'),
    new RegExp('https://jsonplaceholder.typicode.com', 'i')
  ],
  ignoreUrls: [
    // Third-party requests domains to ignore in session recordings
  ]
})

const app = createApp(App)

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  try {
    SessionRecorder.captureException(err, {
      componentName: instance?.$options.name,
      componentInfo: info,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    })
  } catch {
    // Ignore capture errors to avoid recursive crashes
  }
  // Re-throw to preserve default behavior and console logging
  console.error(err, info)
}

app.use(router)
app.mount('#app')
