![Description](../../docs/img/header-js.png)

<div align="center">
<a href="https://github.com/multiplayer-app/multiplayer-session-recorder-javascript">
  <img src="https://img.shields.io/github/stars/multiplayer-app/multiplayer-session-recorder-javascript?style=social&label=Star&maxAge=2592000" alt="GitHub stars">
</a>
  <a href="https://github.com/multiplayer-app/multiplayer-session-recorder-javascript/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/multiplayer-app/multiplayer-session-recorder-javascript" alt="License">
  </a>
  <a href="https://multiplayer.app">
    <img src="https://img.shields.io/badge/Visit-multiplayer.app-blue" alt="Visit Multiplayer">
  </a>
  
</div>
<div>
  <p align="center">
    <a href="https://x.com/trymultiplayer">
      <img src="https://img.shields.io/badge/Follow%20on%20X-000000?style=for-the-badge&logo=x&logoColor=white" alt="Follow on X" />
    </a>
    <a href="https://www.linkedin.com/company/multiplayer-app/">
      <img src="https://img.shields.io/badge/Follow%20on%20LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="Follow on LinkedIn" />
    </a>
    <a href="https://discord.com/invite/q9K3mDzfrx">
      <img src="https://img.shields.io/badge/Join%20our%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join our Discord" />
    </a>
  </p>
</div>

# Multiplayer Node.Js Full Stack Session Recorder

The Multiplayer **Session Recorder** is a powerful tool that offers deep session replays with insights spanning frontend screens, platform traces, metrics, and logs. It helps your team pinpoint and resolve bugs faster by providing a complete picture of your backend system architecture. No more wasted hours combing through APM data; the Multiplayer Session Recorder does it all in one place.

## Key Features

- **Reduced Inefficiencies**: Effortlessly capture the exact steps to reproduce an issue along with backend data in one click. No more hunting through scattered documentation, APM data, logs, or traces.
- **Faster Cross-Team Alignment**: Engineers can share session links containing all relevant information, eliminating the need for long tickets or clarifying issues through back-and-forth communication.
- **Uninterrupted Deep Work**: All system information—from architecture diagrams to API designs—is consolidated in one place. Minimize context switching and stay focused on what matters.

## Getting Started

### Installation

You can install the Session Recorder using npm or yarn:

```bash
npm install @multiplayer-app/session-recorder-node
# or
yarn add @multiplayer-app/session-recorder-node
```

### Basic Setup

To initialize the Session Recorder in your application, follow the steps below.

#### Import the Session Recorder

```javascript
import SessionRecorder from '@multiplayer-app/session-recorder-node'
// Multiplayer trace id generator which is used during opentelemetry initialization
import { idGenerator } from './opentelemetry'
```

#### Initialization

Use the following code to initialize the session recorder with your application details:

```javascript
  SessionRecorder.init({
    apiKey: '{YOUR_API_KEY}',
    traceIdGenerator: idGenerator,
    resourceAttributes: {
      serviceName: '{YOUR_APPLICATION_NAME}'
      version: '{YOUR_APPLICATION_VERSION}',
      environment: '{YOUR_APPLICATION_ENVIRONMENT}',
    }
  })
```

Replace the placeholders with your application’s version, name, environment, and API key.

## Dependencies

This library relies on the following packages:

- **[OpenTelemetry](https://opentelemetry.io/)**: Used to capture backend traces, metrics, and logs that integrate seamlessly with the session replays for comprehensive debugging.

## Example Usage

```javascript
import {
    sessionRecorder,
    SessionType
} from '@multiplayer-app/session-recorder-node'
// Session recorder trace id generator which is used during opentelemetry initialization
import { idGenerator } from './opentelemetry'

sessionRecorder.init({
  apiKey: '{YOUR_API_KEY}',
  traceIdGenerator: idGenerator,
  resourceAttributes: {
    serviceName: '{YOUR_APPLICATION_NAME}',
    version: '{YOUR_APPLICATION_VERSION}',
    environment: '{YOUR_APPLICATION_ENVIRONMENT}',
  }
})

// ...

  await sessionRecorder.start(
    SessionType.PLAIN,
    {
      name: 'This is test session',
      sessionAttributes: {
        accountId: '687e2c0d3ec8ef6053e9dc97',
        accountName: 'Acme Corporation'
      }
    }
  )

  // do something here

  await sessionRecorder.stop()

```
