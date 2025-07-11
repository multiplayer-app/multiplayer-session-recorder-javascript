import { RrwebEventExporter } from './rrweb/exporter'
import { MultiplayerHttpTraceExporterBrowser as TraceExporter } from '@multiplayer-app/opentelemetry'

window['__MP_SDK_EXPORTS__'] = {
  RrwebEventExporter,
  TraceExporter,
}

export { RrwebEventExporter, TraceExporter }