import './patch'
import { setupListeners } from './listeners'
import { recorderEventBus } from './eventBus'
import { CanvasReplayerPlugin } from './rrweb/canvas-plugin'
import { MultiplayerSessionDebugger } from './session-debugger'

const DebuggerInstance = new MultiplayerSessionDebugger()

// Attach the instance to the global object (window in browser)
if (typeof window !== 'undefined') {
  window['__MP_SESSION_DEBUGGER_LOADED'] = true
  window['MultiplayerSessionDebugger'] = DebuggerInstance
  setupListeners(DebuggerInstance)
}

export default DebuggerInstance

export { CanvasReplayerPlugin, recorderEventBus }
