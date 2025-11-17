import { SocketService as RrwebEventExporter } from './services/socket.service'
import { SessionRecorderBrowserTraceExporter as TraceExporter } from '@multiplayer-app/session-recorder-common'

window['__MP_SDK_EXPORTS__'] = {
  RrwebEventExporter,
  TraceExporter,
}

export { RrwebEventExporter, TraceExporter }