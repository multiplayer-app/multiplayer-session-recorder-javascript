import { SessionRecorder } from './sessionRecorder'
import { IDebugSession } from './types'
import messagingService from './services/messaging.service'
import { DebugSessionType } from '@multiplayer-app/otlp-core'



export function setupListeners(sessionRecorder: SessionRecorder): void {
  // Send ready message with session info
  messagingService.sendMessage('ready', {
    session: sessionRecorder.session,
    sessionState: sessionRecorder.sessionState,
  })

  messagingService.on('init', (payload) => {
    sessionRecorder.init(payload)
  })

  messagingService.on('start', (payload) => {
    sessionRecorder.start(DebugSessionType.PLAIN, payload)
  })

  messagingService.on('end', (payload) => {
    sessionRecorder.stop(payload)
  })

  messagingService.on('pause', () => {
    sessionRecorder.pause()
  })

  messagingService.on('cancel', () => {
    sessionRecorder.cancel()
  })

  messagingService.on('toggle-continuous-debugging', (payload: { enabled: boolean, session?: IDebugSession }) => {
    if (payload.enabled) {
      sessionRecorder.start(DebugSessionType.CONTINUOUS, payload.session)
    } else {
      sessionRecorder.stop()
    }
  })

  messagingService.on('save-continuous-debug-session', () => {
    sessionRecorder.save()
  })
}
