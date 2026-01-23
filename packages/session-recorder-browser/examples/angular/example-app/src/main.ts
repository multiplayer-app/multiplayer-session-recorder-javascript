import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import SessionRecorder from '@multiplayer-app/session-recorder-browser';

// Initialize Multiplayer Session Recorder before bootstrapping Angular (Quick Start)
SessionRecorder.init({
  version: '0.0.1',
  apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnRlZ3JhdGlvbiI6IjY5MTFhMGEyNjRkMjk4OWVjNzNlMDVlNCIsIndvcmtzcGFjZSI6IjY4NGMzYmYwYjQ2MGUzMmY3YWJmZjRlMSIsInByb2plY3QiOiI2ODRjM2M0MmI0NjBlMzJmN2FiZmY1YzgiLCJ0eXBlIjoiT1RFTCIsImlhdCI6MTc2Mjc2MjkxNH0.j1JHKC_EgUzmssyhjNUi_jt9Qk6yCuwjiIS64io9GCQ',
  environment: 'production',
  application: 'angular-example',
  apiBaseUrl: 'http://localhost',
  exporterEndpoint: 'http://localhost',
  propagateTraceHeaderCorsUrls: [
    // new RegExp('https://your.backend.api.domain', 'i'),
    new RegExp('https://jsonplaceholder.typicode.com', 'i'),
  ],
  ignoreUrls: [
    // Third-party requests domains to ignore in session recordings
  ],
});

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
