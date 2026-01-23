import { SessionType } from '@multiplayer-app/session-recorder-common';
// import { pack } from '@rrweb/packer' // Removed to avoid blob creation issues in Hermes
import { SocketService } from '../services/socket.service';
import { CrashBufferService } from '../services/crashBuffer.service';
import { logger } from '../utils';
import { ScreenRecorder } from './screenRecorder';
import { GestureRecorder } from './gestureRecorder';
import { NavigationTracker } from './navigationTracker';
import { type RecorderConfig, type EventRecorder } from '../types';
import { type eventWithTime } from '@rrweb/types';
export class RecorderReactNativeSDK implements EventRecorder {
  private isRecording = false;
  private config?: RecorderConfig;
  private screenRecorder: ScreenRecorder;
  private gestureRecorder: GestureRecorder;
  private navigationTracker: NavigationTracker;
  private recordedEvents: eventWithTime[] = [];
  private socketService!: SocketService;
  private crashBuffer?: CrashBufferService;
  private bufferingEnabled: boolean = false;
  private bufferWindowMs: number = 2 * 60 * 1000;
  private sessionId: string | null = null;
  private sessionType: SessionType = SessionType.MANUAL;

  constructor() {
    this.screenRecorder = new ScreenRecorder();
    this.gestureRecorder = new GestureRecorder();
    this.navigationTracker = new NavigationTracker();
  }

  init(
    config: RecorderConfig,
    socketService: SocketService,
    crashBuffer?: CrashBufferService,
    buffering?: { enabled: boolean; windowMs: number },
  ): void {
    this.config = config;
    this.socketService = socketService;
    this.crashBuffer = crashBuffer;
    this.bufferingEnabled = Boolean(buffering?.enabled);
    this.bufferWindowMs = Math.max(10_000, buffering?.windowMs || 1 * 60 * 1000);
    this.screenRecorder.init(config, this);
    this.navigationTracker.init(config, this.screenRecorder);
    this.gestureRecorder.init(config, this, this.screenRecorder);
  }


  start(sessionId: string | null, sessionType: SessionType): void {
    if (!this.config) {
      throw new Error(
        'Configuration not initialized. Call init() before start().'
      );
    }

    this.sessionId = sessionId;
    this.sessionType = sessionType;
    this.isRecording = true;

    // Emit recording started meta event

    if (this.config.recordScreen) {
      this.screenRecorder.start();
    }

    if (this.config.recordGestures) {
      this.gestureRecorder.start();
    }

    if (this.config.recordNavigation) {
      this.navigationTracker.start();
    }
  }

  stop(): void {
    this.isRecording = false;
    this.gestureRecorder.stop();
    this.navigationTracker.stop();
    this.screenRecorder.stop();
    this.socketService?.close();
  }

  setNavigationRef(ref: any): void {
    this.navigationTracker.setNavigationRef(ref);
  }

  /**
   * Set the viewshot ref for screen capture
   * @param ref - React Native View ref for screen capture
   */
  setViewShotRef(ref: any): void {
    this.screenRecorder.setViewShotRef(ref);
  }

  /**
   * Record an rrweb event
   * @param event - The rrweb event to record
   */
  recordEvent(event: eventWithTime): void {
    if (!this.isRecording) {
      return;
    }

    // Buffer-only mode (no active debug session): persist locally.
    if (!this.sessionId && this.crashBuffer && this.bufferingEnabled) {
      void this.crashBuffer.appendRrwebEvent({ ts: event.timestamp, event }, this.bufferWindowMs)
      return
    }

    if (this.socketService) {
      logger.debug('RecorderReactNativeSDK', 'Sending to socket service', event);
      // Skip packing to avoid blob creation issues in Hermes
      // const packedEvent = pack(event)
      this.socketService.send({
        event: event, // Send raw event instead of packed
        eventType: event.type,
        timestamp: event.timestamp,
        debugSessionId: this.sessionId,
        debugSessionType: this.sessionType,
      });
    }
  }

  /**
   * Record touch start event
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   * @param pressure - Touch pressure
   */
  recordTouchStart(
    x: number,
    y: number,
    target?: string,
    pressure?: number
  ): void {
    if (!this.isRecording) {
      return;
    }

    this.gestureRecorder.recordTouchStart(x, y, target, pressure);
  }

  /**
   * Record touch move event
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   * @param pressure - Touch pressure
   */
  recordTouchMove(
    x: number,
    y: number,
    target?: string,
    pressure?: number
  ): void {
    if (!this.isRecording) {
      return;
    }

    this.gestureRecorder.recordTouchMove(x, y, target, pressure);
  }

  /**
   * Record touch end event
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   * @param pressure - Touch pressure
   */
  recordTouchEnd(
    x: number,
    y: number,
    target?: string,
    pressure?: number
  ): void {
    if (!this.isRecording) {
      return;
    }

    this.gestureRecorder.recordTouchEnd(x, y, target, pressure);
  }

  /**
   * Get all recorded events
   * @returns Array of recorded rrweb events
   */
  getRecordedEvents(): eventWithTime[] {
    return [...this.recordedEvents];
  }

  /**
   * Clear all recorded events
   */
  clearRecordedEvents(): void {
    this.recordedEvents = [];
  }

  /**
   * Get recording statistics
   * @returns Recording statistics
   */
  getRecordingStats(): { totalEvents: number; isRecording: boolean } {
    return {
      totalEvents: this.recordedEvents.length,
      isRecording: this.isRecording,
    };
  }
}
