import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import SessionRecorder from '@multiplayer-app/session-recorder-browser';

// Initialize Multiplayer Session Recorder before bootstrapping Angular (Quick Start)
SessionRecorder.init({
  version: '0.0.1',
  apiKey: 'YOUR_API_KEY',
  environment: 'production',
  application: 'angular-example',
  propagateTraceHeaderCorsUrls: [
    // new RegExp('https://your.backend.api.domain', 'i'),
    new RegExp('https://jsonplaceholder.typicode.com', 'i'),
  ],
  ignoreUrls: [
    // Third-party requests domains to ignore in session recordings
  ],
  buffering: {
    enabled: true,
  },
});

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
