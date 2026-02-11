import type * as http from 'node:http'
import { SessionRecorderSdk } from '@multiplayer-app/session-recorder-common'

type ExpressMiddleware = (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void;

type ExpressErrorMiddleware = (
  error: Error,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  next: (error: Error) => void,
) => void;

interface MiddlewareError extends Error {
  status?: number | string;
  statusCode?: number | string;
  status_code?: number | string;
  output?: {
    statusCode?: number | string;
  };
}

interface ExpressHandlerOptions {
  shouldHandleError?(this: void, error: Error): boolean;
}

function getStatusCodeFromResponse(error: MiddlewareError): number {
  const statusCode = error.status || error.statusCode || error.status_code || error.output?.statusCode
  return statusCode ? parseInt(statusCode as string, 10) : 500
}

/** Returns true if response code is internal server error */
function defaultShouldHandleError(error: Error): boolean {
  const status = getStatusCodeFromResponse(error)
  return status >= 500
}

export function expressErrorHandler(options?: ExpressHandlerOptions): ExpressErrorMiddleware {
  return function multiplayerErrorMiddleware(
    error: Error,
    request: http.IncomingMessage,
    res: http.ServerResponse,
    next: (error: Error) => void,
  ): void {
    const shouldHandleError = options?.shouldHandleError || defaultShouldHandleError

    if (shouldHandleError(error)) {
      SessionRecorderSdk.captureException(error)
    }

    next(error)
  }
}
