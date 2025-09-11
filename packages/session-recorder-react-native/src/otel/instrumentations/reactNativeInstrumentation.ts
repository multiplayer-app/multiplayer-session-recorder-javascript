import { InstrumentationBase } from '@opentelemetry/instrumentation'
import { logger } from '../../utils'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import AsyncStorage from '@react-native-async-storage/async-storage'

export class ReactNativeInstrumentation extends InstrumentationBase {
  constructor() {
    super('react-native', '1.0.0', {})
  }

  init(): void {
    // Initialize the instrumentation
  }

  enable(): void {
    // Try to wrap AsyncStorage if it's available
    try {
      if (AsyncStorage) {
        this._wrap(AsyncStorage, 'setItem', this._wrapAsyncStorage)
      }
    } catch (error) {
      logger.warn('DEBUGGER_LIB', '@react-native-async-storage/async-storage is not available. AsyncStorage instrumentation will be disabled.')
    }
  }

  disable(): void {
    // Try to unwrap AsyncStorage if it was wrapped
    try {
      if (AsyncStorage) {
        this._unwrap(AsyncStorage, 'setItem')
      }
    } catch (error) {
      // AsyncStorage was not available, nothing to unwrap
    }
  }

  private _wrapAsyncStorage(originalMethod: any) {
    return async function (this: any, key: string, value: string) {
      const startTime = Date.now()
      try {
        const result = await originalMethod.call(this, key, value)

        const span = trace.getTracer('react-native').startSpan('AsyncStorage.setItem', {
          attributes: {
            'storage.operation': 'setItem',
            'storage.key': key,
            'storage.value_length': value.length,
            'storage.duration': Date.now() - startTime,
          },
        })

        span.setStatus({ code: SpanStatusCode.OK })
        span.end()

        return result
      } catch (error) {
        const span = trace.getTracer('react-native').startSpan('AsyncStorage.setItem', {
          attributes: {
            'storage.operation': 'setItem',
            'storage.key': key,
            'storage.error': true,
            'storage.duration': Date.now() - startTime,
          },
        })

        const errorMessage = error instanceof Error ? error.message : String(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage })
        if (error instanceof Error) {
          span.recordException(error)
        }
        span.end()

        throw error
      }
    }
  }
}
