import io, { Socket } from 'socket.io-client';
import { Observable } from 'lib0/observable';

import { logger } from '../utils';

import {
  SESSION_ADD_EVENT,
  SESSION_AUTO_CREATED,
  SESSION_STOPPED_EVENT,
  SESSION_SUBSCRIBE_EVENT,
  SESSION_UNSUBSCRIBE_EVENT,
  SOCKET_SET_USER_EVENT,
  REMOTE_SESSION_RECORDING_START,
  REMOTE_SESSION_RECORDING_STOP,
  SESSION_STARTED_EVENT,
  SESSION_SAVE_BUFFER_EVENT,
} from '../config';
import {
  type ISession,
  type IUserAttributes,
  ATTR_MULTIPLAYER_SESSION_CLIENT_ID,
} from '@multiplayer-app/session-recorder-common';

const MAX_RECONNECTION_ATTEMPTS = 2;

export type SocketServiceEvents =
  | typeof SESSION_STOPPED_EVENT
  | typeof SESSION_AUTO_CREATED
  | typeof REMOTE_SESSION_RECORDING_START
  | typeof REMOTE_SESSION_RECORDING_STOP
  | typeof SESSION_SAVE_BUFFER_EVENT;

export interface SocketServiceOptions {
  apiKey: string;
  socketUrl: string;
  keepAlive?: boolean;
  clientId?: string;
}

export class SocketService extends Observable<SocketServiceEvents> {
  private socket: Socket | null = null;
  private queue: any[] = [];
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private attempts: number = 0;
  private sessionId: string | null = null;
  private options: SocketServiceOptions;
  private isInitialized: boolean = false;
  private lastUserPayload: {
    userAttributes: IUserAttributes | null;
    clientId?: string;
  } | null = null;
  private lastSubscribeSession: ISession | null = null;
  constructor() {
    super();
    this.options = {
      apiKey: '',
      socketUrl: '',
      keepAlive: false,
    };
  }

  /**
   * Initialize the socket service
   * @param config - Socket service configuration
   */
  public init(config: SocketServiceOptions): void {
    this.options = {
      ...this.options,
      ...config,
    };
    this.isInitialized = true;
    if (
      this.options.keepAlive &&
      this.options.socketUrl &&
      this.options.apiKey
    ) {
      this._initConnection();
    }
  }

  /**
   * Update the socket service configuration
   * @param config - Partial configuration to update
   */
  public updateConfigs(config: Partial<SocketServiceOptions>): void {
    // If any config changed, reconnect if connected
    const hasChanges = Object.keys(config).some((key) => {
      const typedKey = key as keyof SocketServiceOptions;
      return (
        config[typedKey] !== undefined &&
        config[typedKey] !== this.options[typedKey]
      );
    });

    if (hasChanges) {
      this.options = { ...this.options, ...config };
      if (this.socket?.connected) {
        this.close().then(() => {
          if (
            this.options.keepAlive &&
            this.options.socketUrl &&
            this.options.apiKey
          ) {
            this._initConnection();
          }
        });
      }
    }
  }

  private _initConnection(): void {
    if (this.isConnecting || this.isConnected || !this.isInitialized) return;
    this.attempts++;
    this.isConnecting = true;
    this.socket = io(this.options.socketUrl, {
      path: '/v0/radar/ws',
      auth: {
        'x-api-key': this.options.apiKey,
        ...(this.options.clientId
          ? { [ATTR_MULTIPLAYER_SESSION_CLIENT_ID]: this.options.clientId }
          : {}),
      },
      reconnectionAttempts: 2,
      transports: ['websocket'],
    });

    this.socket.on('ready', () => {
      this.isConnecting = false;
      this.isConnected = true;
      logger.info('SocketService', 'Connected to server');
      // Re-establish identity and session on every (re)connect: socket.io's auto-reconnect
      // fires 'ready' again after a drop, but the server has no memory of the previous
      // setUser/subscribe calls — the client must replay them.
      if (this.lastUserPayload && this.socket) {
        this.socket.emit(SOCKET_SET_USER_EVENT, this.lastUserPayload);
      }
      if (this.lastSubscribeSession) {
        this._emitSubscribe(this.lastSubscribeSession);
      }
      this.flushQueue();
    });

    this.socket.on('disconnect', (_err: any) => {
      this.isConnecting = false;
      this.isConnected = false;
      logger.info('SocketService', 'Disconnected from server');
    });

    this.socket.on('connect_error', (err: any) => {
      this.isConnecting = false;
      this.isConnected = false;
      this.checkReconnectionAttempts();
      logger.error('SocketService', 'Error connecting to server', err);
    });

    this.socket.on(SESSION_STOPPED_EVENT, (data: any) => {
      this.emit(SESSION_STOPPED_EVENT, [data]);
    });

    this.socket.on(SESSION_AUTO_CREATED, (data: any) => {
      this.emit(SESSION_AUTO_CREATED, [data]);
    });

    this.socket.on(REMOTE_SESSION_RECORDING_START, (data: any) => {
      this.emit(REMOTE_SESSION_RECORDING_START, [data]);
    });

    this.socket.on(REMOTE_SESSION_RECORDING_STOP, (data: any) => {
      this.emit(REMOTE_SESSION_RECORDING_STOP, [data]);
    });

    this.socket.on(SESSION_SAVE_BUFFER_EVENT, (data: any) => {
      this.emit(SESSION_SAVE_BUFFER_EVENT, [data]);
    });
  }

  private checkReconnectionAttempts(): void {
    if (this.attempts >= MAX_RECONNECTION_ATTEMPTS) {
      this.flushQueue();
    }
  }

  private emitSocketEvent(name: string, data: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(name, data);
    } else {
      this.queue.push({ data, name });
      this._initConnection();
    }
  }

  private flushQueue(): void {
    while (this.queue.length > 0 && this.isConnected) {
      const event = this.queue.shift();
      if (!event) continue;

      if (this.socket && this.isConnected) {
        this.socket.emit(event.name, event.data);
      }
    }
  }

  public send(event: any): void {
    this.emitSocketEvent(SESSION_ADD_EVENT, event);
  }

  public subscribeToSession(session: ISession): void {
    // Remember the session so reconnects replay subscribe + started.
    this.lastSubscribeSession = session;
    this._emitSubscribe(session);
  }

  private _emitSubscribe(session: ISession): void {
    this.sessionId = session.shortId || session._id;
    const subscribePayload = {
      projectId: session.project,
      workspaceId: session.workspace,
      debugSessionId: this.sessionId,
      sessionType: session.creationType,
    };
    const startedPayload = { debugSessionId: session._id };
    // Send directly (not via the queue). The queue would cause a duplicate emit on
    // the next 'ready' alongside the replay, since 'ready' replays lastSubscribeSession.
    if (this.socket && this.isConnected) {
      this.socket.emit(SESSION_SUBSCRIBE_EVENT, subscribePayload);
      this.socket.emit(SESSION_STARTED_EVENT, startedPayload);
    } else {
      // Not connected: 'ready' will replay via lastSubscribeSession once the socket is up.
      this._initConnection();
    }
  }

  public unsubscribeFromSession(stopSession?: boolean) {
    if (this.sessionId) {
      this.emitSocketEvent(SESSION_UNSUBSCRIBE_EVENT, {
        debugSessionId: this.sessionId,
      });
      if (stopSession) {
        this.emitSocketEvent(SESSION_STOPPED_EVENT, {});
      }
    }
    this.lastSubscribeSession = null;
  }

  public setUser(data: {
    userAttributes: IUserAttributes | null;
    clientId?: string;
  }): void {
    // Remember the last identity so 'ready' (initial connect + every reconnect) can replay it.
    // Send directly here rather than queuing: the queue would cause a duplicate emit on the
    // next 'ready' alongside the replay.
    this.lastUserPayload = data;
    if (this.socket && this.isConnected) {
      this.socket.emit(SOCKET_SET_USER_EVENT, data);
    } else {
      // Not connected yet: 'ready' will replay lastUserPayload once the socket is up.
      this._initConnection();
    }
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket?.connected) {
        setTimeout(() => {
          this.unsubscribeFromSession();
          this.attempts = 0;
          this.isConnected = false;
          this.isConnecting = false;
          this.socket?.disconnect();
          this.socket = null;
          resolve();
        }, 500);
      } else {
        resolve();
      }
    });
  }
}
