# Multiplayer Session Recorder

The Multiplayer **Session Recorder** is a powerful tool that offers deep session replays with insights spanning frontend screens, platform traces, metrics, and logs. It helps your team pinpoint and resolve bugs faster by providing a complete picture of your backend system architecture. No more wasted hours combing through APM data; the Multiplayer Session Recorder does it all in one place.

## Key Features

- **Reduced Inefficiencies**: Effortlessly capture the exact steps to reproduce an issue along with backend data in one click. No more hunting through scattered documentation, APM data, logs, or traces.
- **Faster Cross-Team Alignment**: Engineers can share session links containing all relevant information, eliminating the need for long tickets or clarifying issues through back-and-forth communication.
- **Uninterrupted Deep Work**: All system information—from architecture diagrams to API designs—is consolidated in one place. Minimize context switching and stay focused on what matters.

## Getting Started

### Installation

You can install the Multiplayer Session Recorder using npm or yarn:

```bash
npm install @multiplayer-app/session-recorder-node
# or
yarn add @multiplayer-app/session-recorder-node
```

### Basic Setup

To initialize the Multiplayer Session Recorder in your application, follow the steps below.

#### Import the Session Recorder

```javascript
import SessionRecorder from '@multiplayer-app/session-recorder-node'
// Multiplayer trace id generator which is used during opentelemetry initialisation
import { idGenerator } from './opentelemetry'
```

#### Initialization

Use the following code to initialize the session recorder with your application details:

```javascript
  SessionRecorder.init(
    '{YOUR_API_KEY}',
    idGenerator,
    {
      resourceAttributes: {
        serviceName: '{YOUR_APPLICATION_NAME}'
        version: '{YOUR_APPLICATION_VERSION}',
        environment: '{YOUR_APPLICATION_ENVIRONMENT}',
      }
    }
  )
```

Replace the placeholders with your application’s version, name, environment, and API key.

## Dependencies

This library relies on the following packages:

- **[OpenTelemetry](https://opentelemetry.io/)**: Used to capture backend traces, metrics, and logs that integrate seamlessly with the session replays for comprehensive debugging.

## Example Usage

```javascript
import SessionRecorder from '@multiplayer-app/session-recorder-node'
import { SessionType } from '@multiplayer-app/session-recorder-opentelemetry'
// Multiplayer trace id generator which is used during opentelemetry initialisation
import { idGenerator } from './opentelemetry'

SessionRecorder.init(
  '{YOUR_API_KEY}',
  idGenerator,
  {
    resourceAttributes: {
      serviceName: '{YOUR_APPLICATION_NAME}'
      version: '{YOUR_APPLICATION_VERSION}',
      environment: '{YOUR_APPLICATION_ENVIRONMENT}',
    }
  }
)

//
// ...
//

  await SessionRecorder.start(
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

  await SessionRecorder.stop()

```
