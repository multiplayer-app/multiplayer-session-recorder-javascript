import { type NavigationEvent, type RecorderConfig } from '../types';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../utils';

export class NavigationTracker {
  private config?: RecorderConfig;
  private isRecording = false;
  private navigationRef: any = null;
  private navigationListeners: Map<string, any> = new Map();
  private currentRoute: string | null = null;
  private navigationStack: string[] = [];
  private navigationStartTime: number = 0;
  private screenRecorder?: any; // Reference to screen recorder for force capture

  init(config: RecorderConfig, screenRecorder?: any): void {
    this.config = config;
    this.screenRecorder = screenRecorder;
    logger.info('NavigationTracker', 'Navigation tracker initialized', {
      config: this.config,
      screenRecorder: this.screenRecorder,
    });
  }

  setNavigationRef(ref: any): void {
    this.navigationRef = ref;
    if (this.isRecording) {
      this._setupNavigationListener();
    }
  }

  start(): void {
    logger.info('NavigationTracker', 'Navigation tracking started');
    this.isRecording = true;
    this.navigationStack = [];
    this.navigationStartTime = Date.now();
    this._setupNavigationListener();
    // Navigation tracking started
  }

  stop(): void {
    this.isRecording = false;
    this._removeNavigationListener();
    // Navigation tracking stopped
  }

  pause(): void {
    this.isRecording = false;
  }

  resume(): void {
    this.isRecording = true;
    this._setupNavigationListener();
  }

  private _setupNavigationListener(): void {
    if (!this.navigationRef) {
      // Navigation ref not set - silently continue
      return;
    }

    try {
      // Listen to navigation state changes
      const stateListener = this.navigationRef.addListener(
        'state',
        (e: any) => {
          this._recordNavigationEvent('state_change', e.data);
        }
      );

      // Listen to focus events
      const focusListener = this.navigationRef.addListener(
        'focus',
        (e: any) => {
          this._recordNavigationEvent('focus', e.data);
        }
      );

      // Listen to blur events
      const blurListener = this.navigationRef.addListener('blur', (e: any) => {
        this._recordNavigationEvent('blur', e.data);
      });

      // Listen to beforeRemove events
      const beforeRemoveListener = this.navigationRef.addListener(
        'beforeRemove',
        (e: any) => {
          this._recordNavigationEvent('beforeRemove', e.data);
        }
      );

      // Store listeners for cleanup
      this.navigationListeners.set('state', stateListener);
      this.navigationListeners.set('focus', focusListener);
      this.navigationListeners.set('blur', blurListener);
      this.navigationListeners.set('beforeRemove', beforeRemoveListener);

      // Navigation listeners setup complete
    } catch (error) {
      // Failed to setup navigation listeners - silently continue
    }
  }

  private _removeNavigationListener(): void {
    try {
      // Remove all listeners
      this.navigationListeners.forEach((listener, _) => {
        if (listener && typeof listener.remove === 'function') {
          listener.remove();
        }
      });
      this.navigationListeners.clear();
      // Navigation listeners removed
    } catch (error) {
      // Failed to remove navigation listeners - silently continue
    }
  }

  private _getFriendlyRouteTitle(): string | null {
    try {
      const current = this.navigationRef?.getCurrentRoute?.();
      if (!current) return null;
      // Prefer a title set via navigation.setOptions({ title }) if present in params
      const titleFromParams = (current.params &&
        (current.params as any).title) as string | undefined;
      if (titleFromParams && typeof titleFromParams === 'string') {
        return titleFromParams;
      }

      // Fallback to a prettified route name (handles Expo Router style names like 'user-posts/[id]')
      if (current.name && typeof current.name === 'string') {
        const raw = current.name as string;
        // Remove group segments like "(tabs)/" at the beginning
        const withoutGroups = raw.replace(/^\([^)]*\)\//, '');
        // Take last path segment (e.g., 'user-posts/[id]' -> '[id]' is removed later, 'post/[id]' -> 'post')
        const lastSegment = withoutGroups
          .split('/')
          .filter(Boolean)
          .slice(-2)
          .join(' ');
        // Remove dynamic segments like '[id]'
        const withoutParams = lastSegment.replace(/\[[^\]]+\]/g, '').trim();
        // Replace dashes/underscores with spaces and collapse spaces
        const spaced = withoutParams
          .replace(/[-_]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        // Title case
        const titleCase = spaced
          .split(' ')
          .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
          .join(' ');
        return titleCase || raw;
      }

      return null;
    } catch {
      return null;
    }
  }

  private _recordNavigationEvent(eventType: string, data: any): void {
    if (!this.isRecording) return;

    const event: NavigationEvent = {
      type: 'navigate',
      timestamp: Date.now(),
      metadata: {
        eventType,
        navigationDuration: Date.now() - this.navigationStartTime,
        stackDepth: this.navigationStack.length,
      },
    };

    const currentRoute = this.navigationRef?.getCurrentRoute?.() || {};
    const friendlyTitle = this._getFriendlyRouteTitle();
    const routeName = data?.routeName || currentRoute?.name;
    const params = data?.params || currentRoute?.params;
    const key = data?.key || currentRoute?.key;

    if (routeName) {
      event.routeName = routeName;
      this._updateNavigationStack(routeName, eventType);
    }
    if (params) {
      event.params = params;
    }
    if (key) {
      event.metadata!.routeKey = key;
    }
    if (friendlyTitle) {
      event.metadata!.friendlyRouteName = friendlyTitle;
    }
    this._recordOpenTelemetrySpan(event);

    // Force screen capture on navigation events
    // this.screenRecorder?.forceCapture(event.timestamp)
  }

  private _updateNavigationStack(routeName: string, eventType: string): void {
    if (eventType === 'focus' || eventType === 'state_change') {
      if (this.currentRoute !== routeName) {
        this.currentRoute = routeName;
        this.navigationStack.push(routeName);
      }
    } else if (eventType === 'blur' || eventType === 'beforeRemove') {
      const index = this.navigationStack.indexOf(routeName);
      if (index > -1) {
        this.navigationStack.splice(index, 1);
      }
    }
  }

  private _recordOpenTelemetrySpan(event: NavigationEvent): void {
    try {
      const span = trace
        .getTracer('navigation')
        .startSpan(`Navigation.${event.type}`, {
          attributes: {
            'navigation.system': 'ReactNavigation',
            'navigation.operation': event.type,
            'navigation.type': event.type,
            'navigation.timestamp': event.timestamp,
            'navigation.platform': 'react-native',
          },
        });

      if (event.routeName) {
        span.setAttribute('navigation.route_name', event.routeName);
      }
      if (event.params) {
        span.setAttribute('navigation.params', JSON.stringify(event.params));
      }
      if (event.metadata) {
        Object.entries(event.metadata).forEach(([key, value]) => {
          span.setAttribute(`navigation.metadata.${key}`, String(value));
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    } catch (error) {
      // Failed to record OpenTelemetry span for navigation - silently continue
    }
  }

  // Get current navigation state
  getCurrentRoute(): string | null {
    return this.currentRoute;
  }

  getNavigationStack(): string[] {
    return [...this.navigationStack];
  }

  getNavigationDepth(): number {
    return this.navigationStack.length;
  }

  // Get recording status
  isRecordingEnabled(): boolean {
    return this.isRecording;
  }

  // Get navigation duration
  getNavigationDuration(): number {
    return Date.now() - this.navigationStartTime;
  }
}
