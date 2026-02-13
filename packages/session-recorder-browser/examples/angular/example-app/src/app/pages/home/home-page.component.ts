import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { throwError } from 'rxjs';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent {
  /**
   * Throws a synchronous exception that will be caught by Angular's ErrorHandler
   */
  throwSynchronousException(): void {
    throw new Error('Synchronous exception: This error was thrown directly in the component method');
  }

  /**
   * Throws an exception with additional context
   */
  throwExceptionWithContext(): void {
    const error = new Error('Exception with context: User attempted to perform invalid operation');
    (error as any).userAction = 'button-click';
    (error as any).timestamp = new Date().toISOString();
    throw error;
  }

  /**
   * Triggers a Promise rejection that won't be caught by ErrorHandler
   * unless properly handled
   */
  throwAsyncException(): void {
    Promise.reject(new Error('Async exception: Unhandled promise rejection'))
      .catch((err) => {
        // Re-throw to trigger ErrorHandler
        setTimeout(() => {
          throw err;
        }, 0);
      });
  }

  /**
   * Throws an exception after a delay using setTimeout
   */
  throwDelayedException(): void {
    setTimeout(() => {
      throw new Error('Delayed exception: This error was thrown after 1 second delay');
    }, 1000);
  }

  /**
   * Throws an RxJS observable error
   */
  throwObservableError(): void {
    throwError(() => new Error('RxJS observable error: This error was thrown from an observable'))
      .subscribe({
        error: (err) => {
          // Re-throw to trigger ErrorHandler
          throw err;
        }
      });
  }

  /**
   * Triggers a ReferenceError by accessing undefined property
   */
  throwReferenceError(): void {
    // @ts-ignore - intentionally accessing undefined
    const value = undefinedObject.property;
  }

  /**
   * Triggers a TypeError by calling method on null
   */
  throwTypeError(): void {
    const obj: any = null;
    obj.someMethod();
  }

  /**
   * Throws a custom error with stack trace
   */
  throwCustomError(): void {
    class CustomError extends Error {
      constructor(message: string, public code: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    throw new CustomError('Custom error: This is a custom error type', 'CUSTOM_ERROR_001');
  }
}
