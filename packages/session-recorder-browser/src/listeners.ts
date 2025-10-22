import { SessionRecorder } from './sessionRecorder'
import { ISession } from './types'
import messagingService from './services/messaging.service'
import { SessionType } from '@multiplayer-app/session-recorder-common'



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
    sessionRecorder.start(SessionType.MANUAL, payload)
  })

  messagingService.on('end', (payload) => {
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

  messagingService.on('toggle-continuous-debugging', (payload: { enabled: boolean, session?: ISession }) => {
    if (payload.enabled) {
      sessionRecorder.start(SessionType.CONTINUOUS, payload.session)
    } else {
      sessionRecorder.stop()
    }
  })

  messagingService.on('save-continuous-debug-session', () => {
    sessionRecorder.save()
  })
}
