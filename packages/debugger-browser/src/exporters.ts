import { RrwebEventExporter } from './rrweb/exporter'
import { MultiplayerHttpTraceExporterBrowser as TraceExporter } from '@multiplayer-app/otlp-core'

window['__MP_SDK_EXPORTS__'] = {
  RrwebEventExporter,
  TraceExporter,
}

export { RrwebEventExporter, TraceExporter }