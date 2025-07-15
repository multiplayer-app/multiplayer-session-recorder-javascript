import './patch'
import { setupListeners } from './listeners'
import { recorderEventBus } from './eventBus'
import { Debugger } from './debugger'

const DebuggerInstance = new Debugger()

// Attach the instance to the global object (window in browser)
if (typeof window !== 'undefined') {
  window['__MP_SESSION_DEBUGGER_LOADED'] = true
  window['Debugger'] = DebuggerInstance
  setupListeners(DebuggerInstance)
}

export default DebuggerInstance

export { recorderEventBus }
