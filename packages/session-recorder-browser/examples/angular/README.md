# Angular Integration Guide

This guide provides comprehensive instructions for integrating the Multiplayer Session Recorder into your Angular application.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Service-Based Integration](#service-based-integration)
- [App Initializer Integration](#app-initializer-integration)
- [Angular HttpClient Integration](#angular-httpclient-integration)
- [Router Integration](#router-integration)
- [Error Handling](#error-handling)
- [Zone.js Considerations](#zonejs-considerations)
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

The simplest way to integrate the session recorder is to initialize it in your `main.ts` file:

```typescript
// main.ts
import SessionRecorder from '@multiplayer-app/session-recorder-browser'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'
import { AppModule } from './app/app.module'

// Initialize Session Recorder before bootstrapping Angular
SessionRecorder.init({
  application: 'my-angular-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'YOUR_MULTIPLAYER_API_KEY',
  // Configure CORS URLs if your backend is on a different domain
  propagateTraceHeaderCorsUrls: [new RegExp('https://api.example.com', 'i')]
})

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err))
```

## Service-Based Integration

For better Angular integration and dependency injection, create a service wrapper:

### 1. Create the Session Recorder Service

```typescript
// app/services/session-recorder.service.ts
import { Injectable } from '@angular/core'
import SessionRecorder, { SessionType, SessionState } from '@multiplayer-app/session-recorder-browser'
import type { SessionRecorderOptions } from '@multiplayer-app/session-recorder-browser'

@Injectable({
  providedIn: 'root'
})
export class SessionRecorderService {
  private isInitialized = false

  /**
   * Initialize the session recorder
   */
  init(config: SessionRecorderOptions): void {
    if (this.isInitialized) {
      console.warn('SessionRecorder is already initialized')
      return
    }

    SessionRecorder.init(config)
    this.isInitialized = true
  }

  /**
   * Start a manual recording session
   */
  start(sessionType: SessionType = SessionType.MANUAL): void {
    SessionRecorder.start(sessionType)
  }

  /**
   * Stop the current recording session
   */
  async stop(comment?: string): Promise<void> {
    await SessionRecorder.stop(comment)
  }

  /**
   * Pause the current recording session
   */
  async pause(): Promise<void> {
    await SessionRecorder.pause()
  }

  /**
   * Resume a paused recording session
   */
  async resume(): Promise<void> {
    await SessionRecorder.resume()
  }

  /**
   * Cancel the current recording session
   */
  async cancel(): Promise<void> {
    await SessionRecorder.cancel()
  }

  /**
   * Save a continuous recording session
   */
  async save(): Promise<any> {
    return await SessionRecorder.save()
  }

  /**
   * Set session attributes (metadata)
   */
  setSessionAttributes(attributes: Record<string, any>): void {
    SessionRecorder.setSessionAttributes(attributes)
  }

  /**
   * Capture an exception manually
   */
  captureException(error: unknown, errorInfo?: Record<string, any>): void {
    SessionRecorder.captureException(error, errorInfo)
  }

  /**
   * Get the current session state
   */
  get sessionState(): SessionState | null {
    return SessionRecorder.sessionState
  }

  /**
   * Get the current session ID
   */
  get sessionId(): string | null {
    return SessionRecorder.sessionId
  }

  /**
   * Get the current session type
   */
  get sessionType(): SessionType {
    return SessionRecorder.sessionType
  }

  /**
   * Check if continuous recording is enabled
   */
  get continuousRecording(): boolean {
    return SessionRecorder.continuousRecording
  }

  /**
   * Check if the recorder is initialized
   */
  get initialized(): boolean {
    return SessionRecorder.isInitialized
  }

  /**
   * Subscribe to session recorder events
   */
  on(event: 'state-change' | 'init' | 'error', handler: (...args: any[]) => void): void {
    SessionRecorder.on(event, handler)
  }

  /**
   * Unsubscribe from session recorder events
   */
  off(event: 'state-change' | 'init' | 'error', handler: (...args: any[]) => void): void {
    SessionRecorder.off(event, handler)
  }

  /**
   * Get the navigation recorder API for manual navigation tracking
   */
  get navigation() {
    return SessionRecorder.navigation
  }
}
```

### 2. Initialize in App Component or App Initializer

#### Option A: Initialize in App Component

```typescript
// app/app.component.ts
import { Component, OnInit } from '@angular/core'
import { SessionRecorderService } from './services/session-recorder.service'
import { environment } from '../environments/environment'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  constructor(private sessionRecorder: SessionRecorderService) {}

  ngOnInit(): void {
    // Initialize session recorder
    this.sessionRecorder.init({
      application: 'my-angular-app',
      version: environment.version || '1.0.0',
      environment: environment.production ? 'production' : 'development',
      apiKey: environment.multiplayerApiKey,

      // Configure CORS URLs for backend API
      propagateTraceHeaderCorsUrls: [new RegExp(environment.apiUrl, 'i')],

      // Optional: Hide widget and control programmatically
      showWidget: true,
      widgetButtonPlacement: 'bottom-right',

      // Optional: Enable continuous recording
      showContinuousRecording: true,

      // Optional: Configure masking for sensitive data
      masking: {
        maskAllInputs: true,
        maskInputOptions: {
          password: true,
          email: false
        },
        maskBodyFieldsList: ['password', 'token', 'secret'],
        maskHeadersList: ['authorization', 'cookie']
      }
    })

    // Set user context if available
    this.sessionRecorder.setSessionAttributes({
      userId: 'user-123',
      userName: 'John Doe'
    })
  }
}
```

#### Option B: Use APP_INITIALIZER (Recommended)

This ensures the session recorder is initialized before any other services:

```typescript
// app/app.config.ts (Angular 17+)
import { ApplicationConfig, APP_INITIALIZER } from '@angular/core'
import { SessionRecorderService } from './services/session-recorder.service'
import { environment } from './environments/environment'

export function initializeSessionRecorder(sessionRecorder: SessionRecorderService): () => void {
  return () => {
    sessionRecorder.init({
      application: 'my-angular-app',
      version: environment.version || '1.0.0',
      environment: environment.production ? 'production' : 'development',
      apiKey: environment.multiplayerApiKey,
      propagateTraceHeaderCorsUrls: [new RegExp(environment.apiUrl, 'i')],
      showWidget: true,
      showContinuousRecording: true
    })
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeSessionRecorder,
      deps: [SessionRecorderService],
      multi: true
    }
  ]
}
```

For Angular versions before 17, use `app.module.ts`:

```typescript
// app/app.module.ts
import { NgModule, APP_INITIALIZER } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { AppComponent } from './app.component'
import { SessionRecorderService } from './services/session-recorder.service'
import { environment } from '../environments/environment'

export function initializeSessionRecorder(sessionRecorder: SessionRecorderService): () => void {
  return () => {
    sessionRecorder.init({
      application: 'my-angular-app',
      version: environment.version || '1.0.0',
      environment: environment.production ? 'production' : 'development',
      apiKey: environment.multiplayerApiKey,
      propagateTraceHeaderCorsUrls: [new RegExp(environment.apiUrl, 'i')]
    })
  }
}

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeSessionRecorder,
      deps: [SessionRecorderService],
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

## Angular HttpClient Integration

The session recorder automatically patches `XMLHttpRequest` and `fetch`, so it works seamlessly with Angular's `HttpClient` without any additional configuration. All HTTP requests made through `HttpClient` are automatically captured.

### Example: HTTP Requests are Automatically Tracked

```typescript
// app/services/user.service.ts
import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private http: HttpClient) {}

  // This request is automatically tracked by the session recorder
  getUser(id: string): Observable<User> {
    return this.http.get<User>(`/api/users/${id}`)
  }

  // This request is also automatically tracked
  updateUser(id: string, user: Partial<User>): Observable<User> {
    return this.http.put<User>(`/api/users/${id}`, user)
  }
}
```

### HTTP Interceptor Integration (Optional)

If you want to add custom attributes to spans or handle errors, you can create an HTTP interceptor:

```typescript
// app/interceptors/session-recorder.interceptor.ts
import { Injectable } from '@angular/core'
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http'
import { Observable, throwError } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { SessionRecorderService } from '../services/session-recorder.service'
import { trace, context } from '@opentelemetry/api'

@Injectable()
export class SessionRecorderInterceptor implements HttpInterceptor {
  constructor(private sessionRecorder: SessionRecorderService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Automatically capture HTTP errors
        if (error.status >= 400) {
          this.sessionRecorder.captureException(error, {
            url: request.url,
            method: request.method,
            status: error.status,
            statusText: error.statusText
          })
        }
        return throwError(() => error)
      })
    )
  }
}
```

Register the interceptor in your app configuration:

```typescript
// app/app.config.ts
import { provideHttpClient, withInterceptors } from '@angular/common/http'
import { sessionRecorderInterceptor } from './interceptors/session-recorder.interceptor'

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([sessionRecorderInterceptor]))]
}
```

## Router Integration

The session recorder can track navigation changes when `recordNavigation` is enabled (default: `true`). To manually record route changes with full context, use the navigation API:

```typescript
// app/app.component.ts
import { Component, OnInit } from '@angular/core'
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router'
import { filter } from 'rxjs/operators'
import { SessionRecorderService } from './services/session-recorder.service'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  constructor(private router: Router, private activatedRoute: ActivatedRoute, private sessionRecorder: SessionRecorderService) {}

  ngOnInit(): void {
    // Track route changes using the navigation API
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event: NavigationEnd) => {
      // Get route data from the activated route
      let route = this.activatedRoute
      while (route.firstChild) {
        route = route.firstChild
      }

      // Record navigation with full context
      this.sessionRecorder.navigation.record({
        path: event.urlAfterRedirects,
        url: event.urlAfterRedirects,
        routeName: route.snapshot.routeConfig?.path || event.urlAfterRedirects,
        title: document.title,
        navigationType: 'push',
        framework: 'angular',
        source: 'router',
        params: route.snapshot.params,
        state: route.snapshot.data,
        metadata: {
          previousUrl: event.url
        }
      })
    })
  }
}
```

## Error Handling

### Global Error Handler

Create a custom error handler to automatically capture all Angular errors:

```typescript
// app/error-handler/session-recorder.error-handler.ts
import { ErrorHandler, Injectable } from '@angular/core'
import { SessionRecorderService } from '../services/session-recorder.service'

@Injectable()
export class SessionRecorderErrorHandler implements ErrorHandler {
  constructor(private sessionRecorder: SessionRecorderService) {}

  handleError(error: any): void {
    // Capture the error in the session recorder
    this.sessionRecorder.captureException(error, {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    })

    // Log to console (or your logging service)
    console.error('Error caught by SessionRecorderErrorHandler:', error)
  }
}
```

Register the error handler:

```typescript
// app/app.config.ts
import { ErrorHandler } from '@angular/core'
import { SessionRecorderErrorHandler } from './error-handler/session-recorder.error-handler'

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: ErrorHandler,
      useClass: SessionRecorderErrorHandler
    }
  ]
}
```

### Component-Level Error Handling

You can also capture errors in specific components:

```typescript
// app/components/user-profile.component.ts
import { Component } from '@angular/core'
import { SessionRecorderService } from '../services/session-recorder.service'

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html'
})
export class UserProfileComponent {
  constructor(private sessionRecorder: SessionRecorderService) {}

  async loadUserData(): Promise<void> {
    try {
      // Your async operation
      await this.fetchUserData()
    } catch (error) {
      // Capture the error
      this.sessionRecorder.captureException(error, {
        component: 'UserProfileComponent',
        action: 'loadUserData'
      })
    }
  }
}
```

## Zone.js Considerations

The session recorder works seamlessly with Angular's Zone.js. The library uses OpenTelemetry's Zone.js context propagation, which is automatically configured. No additional setup is required.

However, if you're using `NgZone.runOutsideAngular()` for performance-critical code, the session recorder will still capture events, but you may want to ensure proper context propagation:

```typescript
import { NgZone } from '@angular/core'
import { trace, context } from '@opentelemetry/api'

// The session recorder automatically handles zone context
// But if you need manual control:
this.ngZone.runOutsideAngular(() => {
  const activeContext = context.active()
  const span = trace.getSpan(activeContext)
  // Your code here
})
```

## Advanced Configuration

### Custom Masking Configuration

```typescript
this.sessionRecorder.init({
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
    maskInput: (text: string, element: HTMLElement) => {
      if (element.classList.contains('credit-card')) {
        return '****-****-****-' + text.slice(-4)
      }
      return '***MASKED***'
    },

    // Custom text masking function
    maskText: (text: string, element: HTMLElement) => {
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
    maskBody: (payload: any, span: any) => {
      if (payload && typeof payload === 'object') {
        if (payload.password) {
          payload.password = '***MASKED***'
        }
      }
      return payload
    },

    // Custom header masking
    maskHeaders: (headers: any, span: any) => {
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

If you want to hide the widget and control recording programmatically set `showWidget` to `false` on initialization and use the methods below to control recording:

```typescript
// Control recording in your components
export class BugReportComponent {
  constructor(private sessionRecorder: SessionRecorderService) {}

  startRecording(): void {
    this.sessionRecorder.start()
  }

  stopRecording(comment: string): void {
    this.sessionRecorder.stop(comment)
  }

  pauseRecording(): void {
    this.sessionRecorder.pause()
  }

  resumeRecording(): void {
    this.sessionRecorder.resume()
  }
}
```

### Continuous Recording

Enable continuous recording mode for automatic error-based session saving:

```typescript
// Start continuous recording
this.sessionRecorder.start(SessionType.CONTINUOUS)

// Later, save the session when needed
await this.sessionRecorder.save()

// Or stop continuous recording
await this.sessionRecorder.stop()
```

### Listening to Events

```typescript
// In your component or service
ngOnInit(): void {
  this.sessionRecorder.on('state-change', (state: SessionState, sessionType: SessionType) => {
    console.log('Session state changed:', state, sessionType);
  });

  this.sessionRecorder.on('init', (recorder) => {
    console.log('Session recorder initialized');
  });

  this.sessionRecorder.on('error', (error: string) => {
    console.error('Session recorder error:', error);
  });
}

ngOnDestroy(): void {
  // Clean up listeners
  this.sessionRecorder.off('state-change', this.stateChangeHandler);
}
```

## Complete Example

Here's a complete example showing all integration points:

### 1. Environment Configuration

```typescript
// environments/environment.ts
export const environment = {
  production: false,
  version: '1.0.0',
  apiUrl: 'https://api.example.com',
  multiplayerApiKey: 'YOUR_API_KEY_HERE'
}
```

### 2. Session Recorder Service

```typescript
// app/services/session-recorder.service.ts
// (Use the service code from the Service-Based Integration section above)
```

### 3. App Initializer

```typescript
// app/app.config.ts
import { ApplicationConfig, APP_INITIALIZER } from '@angular/core'
import { provideHttpClient, withInterceptors } from '@angular/common/http'
import { provideRouter } from '@angular/router'
import { SessionRecorderService } from './services/session-recorder.service'
import { SessionRecorderInterceptor } from './interceptors/session-recorder.interceptor'
import { SessionRecorderErrorHandler } from './error-handler/session-recorder.error-handler'
import { ErrorHandler } from '@angular/core'
import { environment } from './environments/environment'
import { routes } from './app.routes'

export function initializeSessionRecorder(sessionRecorder: SessionRecorderService): () => void {
  return () => {
    sessionRecorder.init({
      application: 'my-angular-app',
      version: environment.version,
      environment: environment.production ? 'production' : 'development',
      apiKey: environment.multiplayerApiKey,
      propagateTraceHeaderCorsUrls: [new RegExp(environment.apiUrl, 'i')],
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
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([SessionRecorderInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeSessionRecorder,
      deps: [SessionRecorderService],
      multi: true
    },
    {
      provide: ErrorHandler,
      useClass: SessionRecorderErrorHandler
    }
  ]
}
```

### 4. App Component with Router Integration

```typescript
// app/app.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core'
import { Router, NavigationEnd } from '@angular/router'
import { filter, takeUntil } from 'rxjs/operators'
import { Subject } from 'rxjs'
import { SessionRecorderService } from './services/session-recorder.service'

@Component({
  selector: 'app-root',
  template: '<router-outlet></router-outlet>'
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>()

  constructor(private router: Router, private sessionRecorder: SessionRecorderService) {}

  ngOnInit(): void {
    // Track navigation using the navigation API
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        // Record navigation with full context
        this.sessionRecorder.navigation.record({
          path: event.urlAfterRedirects,
          url: event.urlAfterRedirects,
          routeName: event.urlAfterRedirects,
          title: document.title,
          navigationType: 'push',
          framework: 'angular',
          source: 'router'
        })
      })

    // Listen to session recorder events
    this.sessionRecorder.on('state-change', (state, type) => {
      console.log('Recording state:', state, type)
    })
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }
}
```

### 5. Usage in Components

```typescript
// app/components/bug-report.component.ts
import { Component } from '@angular/core'
import { SessionRecorderService } from '../services/session-recorder.service'
import { SessionType } from '@multiplayer-app/session-recorder-browser'

@Component({
  selector: 'app-bug-report',
  template: `
    <button (click)="startRecording()" [disabled]="isRecording">Start Recording</button>
    <button (click)="stopRecording()" [disabled]="!isRecording">Stop Recording</button>
    <button (click)="saveRecording()" [disabled]="!isContinuous">Save Recording</button>
  `
})
export class BugReportComponent {
  isRecording = false
  isContinuous = false

  constructor(private sessionRecorder: SessionRecorderService) {
    // Listen to state changes
    this.sessionRecorder.on('state-change', (state) => {
      this.isRecording = state === '2' // SessionState.started
      this.isContinuous = this.sessionRecorder.continuousRecording
    })
  }

  startRecording(): void {
    this.sessionRecorder.start(SessionType.MANUAL)
  }

  stopRecording(): void {
    this.sessionRecorder.stop('User reported a bug')
  }

  saveRecording(): void {
    this.sessionRecorder.save()
  }
}
```

## Best Practices

1. **Initialize Early**: Use `APP_INITIALIZER` to ensure the session recorder is initialized before other services.

2. **Environment Variables**: Store your API key and configuration in environment files, not in source code.

3. **Error Handling**: Always use a global error handler to capture unhandled errors.

4. **User Context**: Set session attributes with user information when available:

```typescript
// After user login
this.sessionRecorder.setSessionAttributes({
  userId: user.id,
  userName: user.name,
  userEmail: user.email
})
```

5. **Masking**: Configure appropriate masking for sensitive data based on your application's requirements.

6. **CORS Configuration**: Always configure `propagateTraceHeaderCorsUrls` if your backend API is on a different domain.

7. **Testing**: In test environments, you may want to disable the widget or use a test API key.

## Troubleshooting

### Session Recorder Not Capturing HTTP Requests

- Ensure `propagateTraceHeaderCorsUrls` is configured if your API is on a different domain
- Check that the API key is valid
- Verify that `init()` is called before any HTTP requests are made

### Widget Not Appearing

- Check that `showWidget: true` is set in the configuration
- Verify that the initialization completed successfully
- Check browser console for any errors

### Errors Not Being Captured

- Ensure the global error handler is registered
- Check that `captureException()` is being called for manual error capture
- Verify the session recorder is initialized before errors occur

### Zone.js Issues

- The library handles Zone.js automatically, but if you encounter issues, ensure you're using the latest version of `@opentelemetry/context-zone`

## Additional Resources

- [Main README](../README.md) - General documentation
- [API Reference](https://www.multiplayer.app/docs) - Complete API documentation
- [Multiplayer Platform](https://www.multiplayer.app) - Visit the Multiplayer platform

## Support

For issues, questions, or contributions, please visit:

- [GitHub Issues](https://github.com/multiplayer-app/multiplayer-session-recorder-javascript/issues)
- [Discord Community](https://discord.com/invite/q9K3mDzfrx)
