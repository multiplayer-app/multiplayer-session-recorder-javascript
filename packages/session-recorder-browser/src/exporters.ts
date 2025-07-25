import { RrwebEventExporter } from './rrweb/exporter'
import { SessionRecorderHttpTraceExporterBrowser as TraceExporter } from '@multiplayer-app/common'

window['__MP_SDK_EXPORTS__'] = {
  RrwebEventExporter,
  TraceExporter,
}

export { RrwebEventExporter, TraceExporter }