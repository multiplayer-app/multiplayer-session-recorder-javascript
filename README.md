![Description](./docs/img/header-js.png)

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

# Multiplayer Full Stack Session Recorder

The Multiplayer Full Stack Session Recorder is a powerful tool that offers deep session replays with insights spanning frontend screens, platform traces, metrics, and logs. It helps your team pinpoint and resolve bugs faster by providing a complete picture of your backend system architecture. No more wasted hours combing through APM data; the Multiplayer Full Stack Session Recorder does it all in one place.

## What you get

- Full stack replays: browser screen recording correlated with OTLP traces and logs
- One‑click shareable sessions: Engineers can share session links containing all relevant information, eliminating the need for long tickets or clarifying issues through back-and-forth communication.
- Privacy by default: input/text masking and trace payload/header masking
- Flexible: works with any web app; Node SDK for backend correlation
- Lightweight widget: start/pause/stop/save controls for your users or QA

## Monorepo structure

- [packages/session-recorder-browser](./packages/session-recorder-browser/): Browser SDK and in‑app widget
- [packages/session-recorder-node](./packages/session-recorder-node/): Node.js SDK for backend tracing/session control
- [packages/session-recorder-common](./packages/session-recorder-common/): Shared OpenTelemetry utilities and types
- [packages/session-recorder-react-native](./packages/session-recorder-react-native/): React Native SDK and in‑app widget

## License

MIT — see [LICENSE](./LICENSE).
