import { EventEmitter } from 'eventemitter3';
import WebSocket from 'isomorphic-ws';
import { 
  WebSocketError,
  ErrorCode,
  handleError
} from '../utils/errors';

export interface WebSocketConfig {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  timeout?: number;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: number;
}

export class WebSocketProvider extends EventEmitter {
  private ws?: WebSocket;
  private config: Required<WebSocketConfig>;
  private reconnectAttempts: number = 0;
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private isConnecting: boolean = false;
  private isClosing: boolean = false;
  private messageQueue: WebSocketMessage[] = [];

  constructor(config: WebSocketConfig) {
    super();
    
    this.config = {
      url: config.url,
      reconnect: config.reconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 5000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      timeout: config.timeout ?? 10000
    };
  }

  /**
   * Connects to the WebSocket server
   */
  public async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.isClosing = false;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);

        const timeout = setTimeout(() => {
          this.isConnecting = false;
          const error = new WebSocketError(
            ErrorCode.WS_CONNECTION_FAILED,
            'WebSocket connection timeout'
          );
          this.handleError(error);
          reject(error);
        }, this.config.timeout);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.processMessageQueue();
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = this.parseMessage(event.data);
            this.handleMessage(message);
          } catch (error) {
            this.emit('error', new WebSocketError(
              ErrorCode.WS_MESSAGE_ERROR,
              'Failed to parse WebSocket message',
              error
            ));
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          const wsError = new WebSocketError(
            ErrorCode.WS_CONNECTION_FAILED,
            'WebSocket error',
            error
          );
          this.handleError(wsError);
          if (!this.ws || this.ws.readyState === WebSocket.CONNECTING) {
            reject(wsError);
          }
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.stopHeartbeat();
          this.emit('disconnected', {
            code: event.code,
            reason: event.reason
          });
          
          if (!this.isClosing && this.config.reconnect && 
              this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

      } catch (error) {
        this.isConnecting = false;
        const wsError = handleError(error);
        reject(wsError);
      }
    });
  }

  /**
   * Disconnects from the WebSocket server
   */
  public disconnect(): void {
    this.isClosing = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = undefined;
    }
    
    this.messageQueue = [];
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  /**
   * Sends a message through the WebSocket
   */
  public send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue the message if not connected
      this.messageQueue.push(message);
      
      // Try to connect if not already trying
      if (!this.isConnecting) {
        this.connect().catch(error => {
          this.emit('error', error);
        });
      }
      return;
    }

    try {
      const data = JSON.stringify(message);
      this.ws.send(data);
      this.emit('message:sent', message);
    } catch (error) {
      throw new WebSocketError(
        ErrorCode.WS_MESSAGE_ERROR,
        'Failed to send WebSocket message',
        error
      );
    }
  }

  /**
   * Subscribes to a specific channel
   */
  public subscribe(channel: string, params?: any): void {
    this.send({
      type: 'subscribe',
      data: {
        channel,
        ...params
      }
    });
  }

  /**
   * Unsubscribes from a specific channel
   */
  public unsubscribe(channel: string): void {
    this.send({
      type: 'unsubscribe',
      data: {
        channel
      }
    });
  }

  /**
   * Gets the current connection state
   */
  public getState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Checks if connected
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Parses incoming message data
   */
  private parseMessage(data: any): WebSocketMessage {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return {
          type: 'raw',
          data: data,
          timestamp: Date.now()
        };
      }
    }
    
    return {
      type: 'binary',
      data: data,
      timestamp: Date.now()
    };
  }

  /**
   * Handles incoming messages
   */
  private handleMessage(message: WebSocketMessage): void {
    // Handle heartbeat/pong messages
    if (message.type === 'pong' || message.type === 'heartbeat') {
      this.emit('heartbeat', message);
      return;
    }

    // Emit the message for subscribers
    this.emit('message', message);
    
    // Emit channel-specific events
    if (message.type && message.data) {
      this.emit(`message:${message.type}`, message.data);
    }
  }

  /**
   * Handles errors
   */
  private handleError(error: Error): void {
    this.emit('error', error);
  }

  /**
   * Starts the heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({
          type: 'ping',
          data: { timestamp: Date.now() }
        });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stops the heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Schedules a reconnection attempt
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    
    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      delay
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.emit('error', error);
      });
    }, delay);
  }

  /**
   * Clears the reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Processes queued messages after connection
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }
}