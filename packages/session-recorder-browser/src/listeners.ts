import type { SessionRecorder } from './session-recorder'
import messagingService from './services/messaging.service'
import { PACKAGE_VERSION_EXPORT } from './config/constants'
import {
  SessionType,
  type ISession,
} from '@multiplayer-app/session-recorder-common'

export function setupListeners(sessionRecorder: SessionRecorder): void {
  const announceState = (): void => {
    // Send continuous flag first so it is applied before the consumer reacts to
    // the 'ready' message (postMessage preserves delivery order).
    messagingService.sendMessage(
      'continuous-debugging',
      sessionRecorder.continuousRecording,
    )
    messagingService.sendMessage('ready', {
      session: sessionRecorder.session,
      sessionState: sessionRecorder.sessionState,
      // Lets the extension popup detect libs too old to support on-demand state
      // sync (the `get-state` request below).
      version: PACKAGE_VERSION_EXPORT,
    })
  }

  // Announce current state on load...
  announceState()

  // ...and whenever the extension asks (e.g. the popup was opened after the
  // recorder had already initialized, so it missed the initial announcement).
  messagingService.on('get-state', () => {
    announceState()
  })

  messagingService.on('init', (payload) => {
    sessionRecorder.init(payload)
  })

  messagingService.on('start', (payload) => {
    sessionRecorder.start(SessionType.MANUAL, payload)
  })

  messagingService.on('end', (payload) => {
    sessionRecorder.stop(payload)
  })

  messagingService.on('stop', (payload) => {
    sessionRecorder.stop(payload)
  })

  messagingService.on('pause', () => {
    sessionRecorder.pause()
  })

  messagingService.on('resume', () => {
    sessionRecorder.resume()
  })

  messagingService.on('cancel', () => {
    sessionRecorder.cancel()
  })

  messagingService.on(
    'toggle-continuous-debugging',
    (payload: { enabled: boolean; session?: ISession }) => {
      if (payload.enabled) {
        sessionRecorder.start(SessionType.CONTINUOUS, payload.session)
      } else {
        sessionRecorder.stop()
      }
    },
  )

  messagingService.on('save-continuous-debug-session', () => {
    sessionRecorder.save()
  })
}
