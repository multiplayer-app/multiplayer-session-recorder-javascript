# Vue Integration Guide

This guide provides comprehensive instructions for integrating the Multiplayer Session Recorder into your Vue application.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Plugin-Based Integration](#plugin-based-integration)
- [Composable-Based Integration](#composable-based-integration)
- [Vue Router Integration](#vue-router-integration)
- [HTTP Client Integration](#http-client-integration)
- [Error Handling](#error-handling)
- [Advanced Configuration](#advanced-configuration)
- [Complete Example](#complete-example)

## Installation

Install the required packages:

```bash
npm install @multiplayer-app/session-recorder-browser
# or
yarn add @multiplayer-app/session-recorder-browser
```

## Quick Start (Recommended)

The simplest way to integrate the session recorder is to initialize it in your `main.js` file:

```javascript
// main.js
import { createApp } from 'vue'
import App from './App.vue'
import SessionRecorder from '@multiplayer-app/session-recorder-browser'

// Initialize Session Recorder before creating the Vue app
SessionRecorder.init({
  application: 'my-vue-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'YOUR_MULTIPLAYER_API_KEY',
  // Configure CORS URLs if your backend is on a different domain
  propagateTraceHeaderCorsUrls: [new RegExp('https://api.example.com', 'i')]
})

const app = createApp(App)
app.mount('#app')
```

## Plugin-Based Integration

For better Vue integration and reusability, create a Vue plugin:

### 1. Create the Session Recorder Plugin

```javascript
// plugins/session-recorder.js
import SessionRecorder, { SessionType, SessionState } from '@multiplayer-app/session-recorder-browser'
import type { SessionRecorderOptions } from '@multiplayer-app/session-recorder-browser'

export default {
  install(app, options) {
    const config = {
      application: options.application || 'vue-app',
      version: options.version || '1.0.0',
      environment: options.environment || 'production',
      apiKey: options.apiKey,
      ...options
    }

    // Initialize the session recorder
    SessionRecorder.init(config)

    // Make SessionRecorder available globally via app.config.globalProperties
    app.config.globalProperties.$sessionRecorder = SessionRecorder

    // Provide SessionRecorder to all components via provide/inject
    app.provide('sessionRecorder', SessionRecorder)
  }
}
```

### 2. Use the Plugin in Your App

```javascript
// main.js
import { createApp } from 'vue'
import App from './App.vue'
import SessionRecorderPlugin from './plugins/session-recorder'

const app = createApp(App)

app.use(SessionRecorderPlugin, {
  application: 'my-vue-app',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  environment: import.meta.env.MODE === 'production' ? 'production' : 'development',
  apiKey: import.meta.env.VITE_MULTIPLAYER_API_KEY,
  propagateTraceHeaderCorsUrls: [new RegExp(import.meta.env.VITE_API_URL, 'i')],
  showWidget: true,
  showContinuousRecording: true
})

app.mount('#app')
```

### 3. Use in Components (Options API)

```vue
<script>
export default {
  mounted() {
    // Access via this.$sessionRecorder
    this.$sessionRecorder.setSessionAttributes({
      userId: 'user-123',
      userName: 'John Doe'
    })
  },
  methods: {
    startRecording() {
      this.$sessionRecorder.start()
    },
    stopRecording() {
      this.$sessionRecorder.stop('User reported a bug')
    }
  }
}
</script>
```

### 4. Use in Components (Composition API)

```vue
<script setup>
import { inject } from 'vue'

const sessionRecorder = inject('sessionRecorder')

// Set user context
sessionRecorder.setSessionAttributes({
  userId: 'user-123',
  userName: 'John Doe'
})

function startRecording() {
  sessionRecorder.start()
}

function stopRecording() {
  sessionRecorder.stop('User reported a bug')
}
</script>
```

## Composable-Based Integration

For a more idiomatic Vue 3 approach, create a composable:

### 1. Create the Session Recorder Composable

```javascript
// composables/useSessionRecorder.js
import { ref, computed, onMounted } from 'vue'
import SessionRecorder, { SessionType, SessionState } from '@multiplayer-app/session-recorder-browser'
import type { SessionRecorderOptions } from '@multiplayer-app/session-recorder-browser'

let isInitialized = false

export function useSessionRecorder(config) {
  const sessionState = ref(SessionRecorder.sessionState)
  const sessionId = ref(SessionRecorder.sessionId)
  const sessionType = ref(SessionRecorder.sessionType)
  const continuousRecording = ref(SessionRecorder.continuousRecording)

  // Initialize if not already initialized
  if (!isInitialized && config) {
    SessionRecorder.init(config)
    isInitialized = true

    // Listen to state changes
    SessionRecorder.on('state-change', (state, type) => {
      sessionState.value = state
      sessionType.value = type
      sessionId.value = SessionRecorder.sessionId
      continuousRecording.value = SessionRecorder.continuousRecording
    })
  }

  // Computed properties
  const isRecording = computed(() => sessionState.value === SessionState.started)
  const isPaused = computed(() => sessionState.value === SessionState.paused)
  const isStopped = computed(() => sessionState.value === SessionState.stopped)

  // Methods
  const start = (type = SessionType.MANUAL) => {
    SessionRecorder.start(type)
  }

  const stop = async (comment) => {
    await SessionRecorder.stop(comment)
  }

  const pause = async () => {
    await SessionRecorder.pause()
  }

  const resume = async () => {
    await SessionRecorder.resume()
  }

  const cancel = async () => {
    await SessionRecorder.cancel()
  }

  const save = async () => {
    return await SessionRecorder.save()
  }

  const setSessionAttributes = (attributes) => {
    SessionRecorder.setSessionAttributes(attributes)
  }

  const captureException = (error, errorInfo) => {
    SessionRecorder.captureException(error, errorInfo)
  }

  const on = (event, handler) => {
    SessionRecorder.on(event, handler)
  }

  const off = (event, handler) => {
    SessionRecorder.off(event, handler)
  }

  return {
    // State
    sessionState,
    sessionId,
    sessionType,
    continuousRecording,
    isRecording,
    isPaused,
    isStopped,
    initialized: computed(() => SessionRecorder.isInitialized),

    // Methods
    start,
    stop,
    pause,
    resume,
    cancel,
    save,
    setSessionAttributes,
    captureException,
    on,
    off,
    navigation: SessionRecorder.navigation
  }
}
```

### 2. Initialize in main.js

```javascript
// main.js
import { createApp } from 'vue'
import App from './App.vue'
import { useSessionRecorder } from './composables/useSessionRecorder'

// Initialize session recorder
useSessionRecorder({
  application: 'my-vue-app',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  environment: import.meta.env.MODE === 'production' ? 'production' : 'development',
  apiKey: import.meta.env.VITE_MULTIPLAYER_API_KEY,
  propagateTraceHeaderCorsUrls: [new RegExp(import.meta.env.VITE_API_URL, 'i')],
  showWidget: true,
  showContinuousRecording: true
})

const app = createApp(App)
app.mount('#app')
```

### 3. Use in Components

```vue
<script setup>
import { useSessionRecorder } from '@/composables/useSessionRecorder'
import { SessionType } from '@multiplayer-app/session-recorder-browser'

const { isRecording, isPaused, continuousRecording, start, stop, pause, resume, save, setSessionAttributes, captureException } =
  useSessionRecorder()

// Set user context when user logs in
function onUserLogin(user) {
  setSessionAttributes({
    userId: user.id,
    userName: user.name,
    userEmail: user.email
  })
}

// Start manual recording
function handleStartRecording() {
  start(SessionType.MANUAL)
}

// Start continuous recording
function handleStartContinuous() {
  start(SessionType.CONTINUOUS)
}

// Stop recording
async function handleStopRecording() {
  await stop('User finished recording')
}

// Save continuous recording
async function handleSaveRecording() {
  await save()
}

// Handle errors
function handleError(error) {
  captureException(error, {
    component: 'MyComponent',
    action: 'handleSubmit'
  })
}
</script>

<template>
  <div>
    <button @click="handleStartRecording" :disabled="isRecording">Start Recording</button>
    <button @click="handleStartContinuous" :disabled="isRecording">Start Continuous</button>
    <button @click="pause" :disabled="!isRecording || isPaused">Pause</button>
    <button @click="resume" :disabled="!isPaused">Resume</button>
    <button @click="handleStopRecording" :disabled="!isRecording">Stop Recording</button>
    <button @click="handleSaveRecording" :disabled="!continuousRecording">Save Recording</button>
  </div>
</template>
```

## Vue Router Integration

The session recorder can track navigation changes when `recordNavigation` is enabled (default: `true`). To manually record route changes with full context, use the navigation API:

### Using Vue Router with Options API

```vue
<script>
import { useRouter, useRoute } from 'vue-router'

export default {
  mounted() {
    const router = useRouter()
    const route = useRoute()

    // Track route changes
    router.afterEach((to, from) => {
      this.$sessionRecorder.navigation.record({
        path: to.path,
        url: to.fullPath,
        routeName: to.name || to.path,
        title: document.title,
        navigationType: to.meta.transition || 'push',
        framework: 'vue',
        source: 'router',
        params: to.params,
        query: to.query,
        meta: to.meta,
        metadata: {
          previousPath: from.path,
          previousUrl: from.fullPath
        }
      })
    })
  }
}
</script>
```

### Using Vue Router with Composition API

```vue
<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionRecorder } from '@/composables/useSessionRecorder'

const router = useRouter()
const { navigation } = useSessionRecorder()

onMounted(() => {
  // Track route changes
  router.afterEach((to, from) => {
    navigation.record({
      path: to.path,
      url: to.fullPath,
      routeName: to.name || to.path,
      title: document.title,
      navigationType: to.meta.transition || 'push',
      framework: 'vue',
      source: 'router',
      params: to.params,
      query: to.query,
      meta: to.meta,
      metadata: {
        previousPath: from.path,
        previousUrl: from.fullPath
      }
    })
  })
})
</script>
```

### Router Plugin Integration

You can also create a router plugin for automatic navigation tracking:

```javascript
// plugins/router-tracker.js
import { useSessionRecorder } from '@/composables/useSessionRecorder'

export default {
  install(app, { router }) {
    const { navigation } = useSessionRecorder()

    router.afterEach((to, from) => {
      navigation.record({
        path: to.path,
        url: to.fullPath,
        routeName: to.name || to.path,
        title: document.title,
        navigationType: to.meta.transition || 'push',
        framework: 'vue',
        source: 'router',
        params: to.params,
        query: to.query,
        meta: to.meta,
        metadata: {
          previousPath: from.path,
          previousUrl: from.fullPath
        }
      })
    })
  }
}

// main.js
import RouterTrackerPlugin from './plugins/router-tracker'

app.use(RouterTrackerPlugin, { router })
```

## HTTP Client Integration

The session recorder automatically patches `XMLHttpRequest` and `fetch`, so it works seamlessly with Axios, Fetch API, and other HTTP clients without any additional configuration. All HTTP requests are automatically captured.

### Axios Integration

```javascript
// services/api.js
import axios from 'axios'

// All requests made with axios are automatically tracked
export const api = axios.create({
  baseURL: 'https://api.example.com'
})

// Example usage
export async function getUser(id) {
  const response = await api.get(`/users/${id}`)
  return response.data
}
```

### Axios Interceptor for Error Handling

You can add an interceptor to automatically capture HTTP errors:

```javascript
// plugins/axios-interceptor.js
import axios from 'axios'
import { useSessionRecorder } from '@/composables/useSessionRecorder'

export function setupAxiosInterceptor() {
  const { captureException } = useSessionRecorder()

  // Response interceptor for error handling
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      // Automatically capture HTTP errors
      if (error.response) {
        captureException(error, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response.status,
          statusText: error.response.statusText,
          responseData: error.response.data
        })
      }
      return Promise.reject(error)
    }
  )
}

// main.js
import { setupAxiosInterceptor } from './plugins/axios-interceptor'
setupAxiosInterceptor()
```

### Fetch API Integration

```javascript
// services/api.js
// All fetch requests are automatically tracked
export async function fetchUser(id) {
  const response = await fetch(`https://api.example.com/users/${id}`)
  return response.json()
}
```

## Error Handling

### Global Error Handler

Vue 3 provides error handling via `app.config.errorHandler`:

```javascript
// main.js
import { createApp } from 'vue'
import App from './App.vue'
import SessionRecorder from '@multiplayer-app/session-recorder-browser'

const app = createApp(App)

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  // Capture the error in the session recorder
  SessionRecorder.captureException(err, {
    componentName: instance?.$options.name,
    componentInfo: info,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href
  })

  // Log to console (or your logging service)
  console.error('Error caught by Vue error handler:', err, info)
}

app.mount('#app')
```

### Using Composable for Error Handling

```javascript
// composables/useErrorHandler.js
import { onErrorCaptured } from 'vue'
import { useSessionRecorder } from './useSessionRecorder'

export function useErrorHandler() {
  const { captureException } = useSessionRecorder()

  onErrorCaptured((err, instance, info) => {
    captureException(err, {
      componentName: instance?.$options.name,
      componentInfo: info,
      timestamp: new Date().toISOString()
    })
    return false // Don't prevent error propagation
  })
}

// In your root component
;<script setup>import {useErrorHandler} from '@/composables/useErrorHandler' useErrorHandler()</script>
```

### Component-Level Error Handling

You can also capture errors in specific components:

```vue
<script setup>
import { useSessionRecorder } from '@/composables/useSessionRecorder'

const { captureException } = useSessionRecorder()

async function loadUserData() {
  try {
    // Your async operation
    await fetchUserData()
  } catch (error) {
    // Capture the error
    captureException(error, {
      component: 'UserProfile',
      action: 'loadUserData'
    })
  }
}
</script>
```

### Unhandled Promise Rejections

The session recorder automatically captures unhandled promise rejections. You can also manually handle them:

```javascript
// main.js
window.addEventListener('unhandledrejection', (event) => {
  SessionRecorder.captureException(event.reason, {
    type: 'unhandledrejection',
    timestamp: new Date().toISOString()
  })
})
```

## Advanced Configuration

### Custom Masking Configuration

```javascript
useSessionRecorder({
  // ... other config
  masking: {
    // Mask all input fields
    maskAllInputs: true,

    // Specific input type masking
    maskInputOptions: {
      password: true,
      email: false,
      tel: false,
      number: false
    },

    // Class-based masking
    maskTextClass: /sensitive|private|confidential/i,

    // CSS selector masking
    maskTextSelector: '.sensitive-data, [data-sensitive]',

    // Custom input masking function
    maskInput: (text, element) => {
      if (element.classList.contains('credit-card')) {
        return '****-****-****-' + text.slice(-4)
      }
      return '***MASKED***'
    },

    // Custom text masking function
    maskText: (text, element) => {
      if (element.dataset.type === 'email') {
        const [local, domain] = text.split('@')
        return local.charAt(0) + '***@' + domain
      }
      return '***MASKED***'
    },

    // Body and header masking
    maskBodyFieldsList: ['password', 'token', 'secret', 'apiKey'],
    maskHeadersList: ['authorization', 'cookie', 'x-api-key'],

    // Custom body masking
    maskBody: (payload, span) => {
      if (payload && typeof payload === 'object') {
        if (payload.password) {
          payload.password = '***MASKED***'
        }
      }
      return payload
    },

    // Custom header masking
    maskHeaders: (headers, span) => {
      if (headers && typeof headers === 'object') {
        if (headers.authorization) {
          headers.authorization = '***MASKED***'
        }
      }
      return headers
    }
  }
})
```

### Programmatic Control Without Widget

If you want to hide the widget and control recording programmatically:

```javascript
useSessionRecorder({
  // ... other config
  showWidget: false
})

// Control recording in your components
const { start, stop, pause, resume } = useSessionRecorder()

function startRecording() {
  start()
}

function stopRecording(comment) {
  stop(comment)
}
```

### Continuous Recording

Enable continuous recording mode for automatic error-based session saving:

```vue
<script setup>
import { useSessionRecorder } from '@/composables/useSessionRecorder'
import { SessionType } from '@multiplayer-app/session-recorder-browser'

const { start, save, stop, continuousRecording } = useSessionRecorder()

// Start continuous recording
function startContinuous() {
  start(SessionType.CONTINUOUS)
}

// Later, save the session when needed
async function saveSession() {
  await save()
}

// Or stop continuous recording
async function stopContinuous() {
  await stop()
}
</script>
```

### Listening to Events

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useSessionRecorder } from '@/composables/useSessionRecorder'
import { SessionState, SessionType } from '@multiplayer-app/session-recorder-browser'

const { on, off } = useSessionRecorder()

function handleStateChange(state, type) {
  console.log('Session state changed:', state, type)
}

function handleInit(recorder) {
  console.log('Session recorder initialized')
}

function handleError(error) {
  console.error('Session recorder error:', error)
}

onMounted(() => {
  on('state-change', handleStateChange)
  on('init', handleInit)
  on('error', handleError)
})

onUnmounted(() => {
  off('state-change', handleStateChange)
  off('init', handleInit)
  off('error', handleError)
})
</script>
```

## Complete Example

Here's a complete example showing all integration points:

### 1. Environment Configuration

```javascript
// .env
VITE_APP_VERSION=1.0.0
VITE_API_URL=https://api.example.com
VITE_MULTIPLAYER_API_KEY=YOUR_API_KEY_HERE
```

### 2. Session Recorder Composable

```javascript
// composables/useSessionRecorder.js
// (Use the composable code from the Composable-Based Integration section above)
```

### 3. Main Application Setup

```javascript
// main.js
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { useSessionRecorder } from './composables/useSessionRecorder'
import { setupAxiosInterceptor } from './plugins/axios-interceptor'
import routes from './routes'

// Initialize session recorder
useSessionRecorder({
  application: 'my-vue-app',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  environment: import.meta.env.MODE === 'production' ? 'production' : 'development',
  apiKey: import.meta.env.VITE_MULTIPLAYER_API_KEY,
  propagateTraceHeaderCorsUrls: [new RegExp(import.meta.env.VITE_API_URL, 'i')],
  showWidget: true,
  showContinuousRecording: true,
  recordNavigation: true,
  masking: {
    maskAllInputs: true,
    maskInputOptions: {
      password: true
    },
    maskBodyFieldsList: ['password', 'token'],
    maskHeadersList: ['authorization']
  }
})

// Setup router
const router = createRouter({
  history: createWebHistory(),
  routes
})

// Setup axios interceptor
setupAxiosInterceptor()

// Create app
const app = createApp(App)

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  const { captureException } = useSessionRecorder()
  captureException(err, {
    componentName: instance?.$options.name,
    componentInfo: info
  })
  console.error('Error caught by Vue error handler:', err, info)
}

app.use(router)
app.mount('#app')
```

### 4. Router Setup with Navigation Tracking

```javascript
// router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useSessionRecorder } from '@/composables/useSessionRecorder'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Your routes here
  ]
})

// Track navigation
const { navigation } = useSessionRecorder()

router.afterEach((to, from) => {
  navigation.record({
    path: to.path,
    url: to.fullPath,
    routeName: to.name || to.path,
    title: document.title,
    navigationType: to.meta.transition || 'push',
    framework: 'vue',
    source: 'router',
    params: to.params,
    query: to.query,
    meta: to.meta,
    metadata: {
      previousPath: from.path,
      previousUrl: from.fullPath
    }
  })
})

export default router
```

### 5. Usage in Components

```vue
<!-- components/BugReport.vue -->
<script setup>
import { ref } from 'vue'
import { useSessionRecorder } from '@/composables/useSessionRecorder'
import { SessionType, SessionState } from '@multiplayer-app/session-recorder-browser'

const { isRecording, isPaused, continuousRecording, start, stop, pause, resume, save } = useSessionRecorder()

const comment = ref('')

function handleStartRecording() {
  start(SessionType.MANUAL)
}

function handleStartContinuous() {
  start(SessionType.CONTINUOUS)
}

async function handleStopRecording() {
  await stop(comment.value || 'User finished recording')
  comment.value = ''
}

async function handleSaveRecording() {
  await save()
}
</script>

<template>
  <div class="bug-report">
    <h2>Bug Report</h2>
    <div class="controls">
      <button @click="handleStartRecording" :disabled="isRecording">Start Recording</button>
      <button @click="handleStartContinuous" :disabled="isRecording">Start Continuous</button>
      <button @click="pause" :disabled="!isRecording || isPaused">Pause</button>
      <button @click="resume" :disabled="!isPaused">Resume</button>
      <button @click="handleStopRecording" :disabled="!isRecording">Stop Recording</button>
      <button @click="handleSaveRecording" :disabled="!continuousRecording">Save Recording</button>
    </div>
    <div v-if="isRecording" class="comment-section">
      <label>Comment (optional):</label>
      <textarea v-model="comment" placeholder="Describe the issue..."></textarea>
    </div>
  </div>
</template>
```

## Best Practices

1. **Initialize Early**: Initialize the session recorder in `main.js` before creating the Vue app to ensure it's ready before any components load.

2. **Environment Variables**: Store your API key and configuration in environment files (`.env`), not in source code.

3. **Error Handling**: Always use a global error handler (`app.config.errorHandler`) to capture unhandled errors.

4. **User Context**: Set session attributes with user information when available:

```javascript
// After user login
const { setSessionAttributes } = useSessionRecorder()
setSessionAttributes({
  userId: user.id,
  userName: user.name,
  userEmail: user.email
})
```

5. **Masking**: Configure appropriate masking for sensitive data based on your application's requirements.

6. **CORS Configuration**: Always configure `propagateTraceHeaderCorsUrls` if your backend API is on a different domain.

7. **Testing**: In test environments, you may want to disable the widget or use a test API key.

8. **Composables**: Use composables for better code organization and reusability in Vue 3 applications.

9. **Cleanup**: Always clean up event listeners in `onUnmounted` hooks to prevent memory leaks.

## Troubleshooting

### Session Recorder Not Capturing HTTP Requests

- Ensure `propagateTraceHeaderCorsUrls` is configured if your API is on a different domain
- Check that the API key is valid
- Verify that `init()` is called before any HTTP requests are made
- Check browser console for CORS errors

### Widget Not Appearing

- Check that `showWidget: true` is set in the configuration
- Verify that the initialization completed successfully
- Check browser console for any errors
- Ensure no CSS is hiding the widget

### Errors Not Being Captured

- Ensure the global error handler is registered in `main.js`
- Check that `captureException()` is being called for manual error capture
- Verify the session recorder is initialized before errors occur
- Check that unhandled promise rejections are being captured

### Router Navigation Not Tracked

- Ensure `recordNavigation: true` is set in the configuration
- Verify that the router navigation tracking code is properly set up
- Check that `router.afterEach` is being called

### Vue 3 Composition API Issues

- Ensure you're using Vue 3 (not Vue 2)
- Check that composables are properly exported and imported
- Verify that `provide/inject` is set up correctly if using the plugin approach

## Additional Resources

- [Main README](../README.md) - General documentation
- [API Reference](https://www.multiplayer.app/docs) - Complete API documentation
- [Multiplayer Platform](https://www.multiplayer.app) - Visit the Multiplayer platform
- [Vue 3 Documentation](https://vuejs.org/) - Official Vue.js documentation

## Support

For issues, questions, or contributions, please visit:

- [GitHub Issues](https://github.com/multiplayer-app/multiplayer-session-recorder-javascript/issues)
- [Discord Community](https://discord.com/invite/q9K3mDzfrx)
