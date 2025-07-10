import { IDebugSession } from './types'
import messagingService from './services/messaging.service'
import { MultiplayerSessionDebugger } from './session-debugger'
import { DebugSessionType } from '@multiplayer-app/otlp-core'



export function setupListeners(debuggerInstance: MultiplayerSessionDebugger): void {
  // Send ready message with session info
  messagingService.sendMessage('ready', {
    session: debuggerInstance.session,
    sessionState: debuggerInstance.sessionState,
  })

  messagingService.on('init', (payload) => {
    debuggerInstance.init(payload)
  })

  messagingService.on('start', (payload) => {
    debuggerInstance.start(DebugSessionType.PLAIN, payload)
  })

  messagingService.on('end', (payload) => {
    debuggerInstance.stop(payload)
  })

  messagingService.on('pause', () => {
    debuggerInstance.pause()
  })

  messagingService.on('cancel', () => {
    debuggerInstance.cancel()
  })

  messagingService.on('toggle-continuous-debugging', (payload: { enabled: boolean, session?: IDebugSession }) => {
    if (payload.enabled) {
      debuggerInstance.start(DebugSessionType.CONTINUOUS)
    } else {
      debuggerInstance.cancel()
    }
  })

  messagingService.on('save-continuous-debug-session', () => {
    debuggerInstance.save()
  })
}