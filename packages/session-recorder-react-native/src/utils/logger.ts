/**
 * Centralized logger utility for the session recorder
 * Provides consistent logging across all components
 */

import { LogLevel } from '../types';

export interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
  enablePrefix: boolean;
  prefix: string;
}

class Logger {
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    enabled: true,
    enablePrefix: true,
    prefix: '[SessionRecorder]',
  };

  private componentPrefixes: Map<string, string> = new Map([
    ['ScreenRecorder', '📸'],
    ['NativeGestureRecorder', '👆'],
    ['SessionRecorderContext', '🎯'],
    ['EventExporter', '📤'],
    ['NavigationTracker', '📸'],
    ['RecorderReactNativeSDK', '📤'],
    ['DEBUGGER_LIB', '🔍'],
  ]);

  /**
   * Configure the logger
   * @param config - Logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set the log level
   * @param level - Log level to set
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Enable or disable console output
   * @param enabled - Whether to enable console output
   */
  setConsoleEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Add or update a component prefix
   * @param component - Component name
   * @param emoji - Emoji prefix for the component
   */
  setComponentPrefix(component: string, emoji: string): void {
    this.componentPrefixes.set(component, emoji);
  }

  /**
   * Get the formatted prefix for a component
   * @param component - Component name
   * @returns Formatted prefix string
   */
  private getPrefix(component: string): string {
    if (!this.config.enablePrefix) return '';

    const emoji = this.componentPrefixes.get(component) || '📝';
    return `${this.config.prefix} ${emoji} [${component}]`;
  }

  /**
   * Check if a log level should be output
   * @param level - Log level to check
   * @returns True if should output
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level && this.config.enabled;
  }

  /**
   * Format the log message
   * @param component - Component name
   * @param level - Log level
   * @param message - Log message
   * @param data - Additional data to log
   * @returns Formatted log message
   */
  private formatMessage(
    component: string,
    level: LogLevel,
    message: string,
    data?: any
  ): string {
    const prefix = this.getPrefix(component);
    const levelName = LogLevel[level];

    let formattedMessage = `${prefix} ${levelName} ${message}`;

    if (data !== undefined) {
      formattedMessage += ` ${JSON.stringify(data)}`;
    }

    return formattedMessage;
  }

  /**
   * Log a debug message
   * @param component - Component name
   * @param message - Log message
   * @param data - Additional data to log
   */
  debug(component: string, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const formattedMessage = this.formatMessage(
      component,
      LogLevel.DEBUG,
      message,
      data
    );

    console.log(formattedMessage);
  }

  /**
   * Log an info message
   * @param component - Component name
   * @param message - Log message
   * @param data - Additional data to log
   */
  info(component: string, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const formattedMessage = this.formatMessage(
      component,
      LogLevel.INFO,
      message,
      data
    );

    console.log(formattedMessage);
  }

  /**
   * Log a warning message
   * @param component - Component name
   * @param message - Log message
   * @param data - Additional data to log
   */
  warn(component: string, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const formattedMessage = this.formatMessage(
      component,
      LogLevel.WARN,
      message,
      data
    );

    console.warn(formattedMessage);
  }

  /**
   * Log an error message
   * @param component - Component name
   * @param message - Log message
   * @param data - Additional data to log
   */
  error(component: string, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const formattedMessage = this.formatMessage(
      component,
      LogLevel.ERROR,
      message,
      data
    );

    console.error(formattedMessage);
  }

  /**
   * Log a success message (info level with success emoji)
   * @param component - Component name
   * @param message - Log message
   * @param data - Additional data to log
   */
  success(component: string, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const prefix = this.getPrefix(component);
    const formattedMessage = `${prefix} ✅ ${message}`;

    let fullMessage = formattedMessage;
    if (data !== undefined) {
      fullMessage += ` ${JSON.stringify(data)}`;
    }

    console.log(fullMessage);
  }

  /**
   * Log a failure message (error level with failure emoji)
   * @param component - Component name
   * @param message - Log message
   * @param data - Additional data to log
   */
  failure(component: string, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const prefix = this.getPrefix(component);
    const formattedMessage = `${prefix} ❌ ${message}`;

    let fullMessage = formattedMessage;
    if (data !== undefined) {
      fullMessage += ` ${JSON.stringify(data)}`;
    }

    console.error(fullMessage);
  }
}

// Export a singleton instance
export const logger = new Logger();

// Export convenience functions for common use cases
export const logDebug = (component: string, message: string, data?: any) =>
  logger.debug(component, message, data);
export const logInfo = (component: string, message: string, data?: any) =>
  logger.info(component, message, data);
export const logWarn = (component: string, message: string, data?: any) =>
  logger.warn(component, message, data);
export const logError = (component: string, message: string, data?: any) =>
  logger.error(component, message, data);
export const logSuccess = (component: string, message: string, data?: any) =>
  logger.success(component, message, data);
export const logFailure = (component: string, message: string, data?: any) =>
  logger.failure(component, message, data);
