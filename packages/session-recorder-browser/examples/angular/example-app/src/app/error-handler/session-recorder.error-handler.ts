import { ErrorHandler, Injectable } from '@angular/core';
import SessionRecorder from '@multiplayer-app/session-recorder-browser';

@Injectable()
export class SessionRecorderErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    try {
      SessionRecorder.captureException(error);
    } catch {
      // Ignore capture errors to avoid recursive crashes
    }
    // Re-throw to preserve default behavior and console logging
    console.error(error);
  }
}
