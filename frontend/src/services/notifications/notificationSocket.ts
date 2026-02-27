/**
 * Singleton socket for notifications-service.
 * Replaces the ad-hoc io() calls in Header.tsx.
 * Used by Header (notification.created) and NextExam/SessionsList (session.status.changed).
 */
import { authSDK } from '@/services/sdk-simple-auth';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

type EventCallback = (data: any) => void;

// Events that are Socket.IO lifecycle events — NOT forwarded via _forward()
const LIFECYCLE_EVENTS = new Set(['connect', 'disconnect']);

class NotificationSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private connectPromise: Promise<void> | null = null;

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      console.log('[NotificationSocket] connect() called but already connected');
      return;
    }
    if (this.connectPromise) {
      console.log('[NotificationSocket] connect() called while connecting — reusing promise');
      return this.connectPromise;
    }

    this.connectPromise = this._doConnect().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private async _doConnect(): Promise<void> {
    const currentUser = authSDK.getCurrentUser();
    const token = authSDK.getAccessToken();

    console.log('[NotificationSocket] _doConnect() — user:', currentUser?.id, 'role:', currentUser?.role, 'hasToken:', !!token);

    if (!token || !currentUser) {
      console.warn('[NotificationSocket] No token or user — aborting connect');
      return;
    }

    let userId = currentUser.id;

    // Students join as their candidateId so the server can target them
    if (currentUser.role === 'student') {
      try {
        const { data } = await axios.get(
          `${import.meta.env.VITE_USER_MANAGEMENT_URL}/api/v1/candidates/by-auth-user/${currentUser.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        userId = data.data._id;
        console.log('[NotificationSocket] Resolved candidateId:', userId);
      } catch (e) {
        console.error('[NotificationSocket] Could not resolve candidateId, using authUserId:', e);
      }
    }

    const rawUrl =
      import.meta.env.VITE_NOTIFICATION_SERVICE_WS ||
      import.meta.env.VITE_NOTIFICATION_SERVICE_URL ||
      'http://localhost:3001';

    // Socket.IO uses the origin only — strip any path like /api/v1 to avoid
    // treating it as a namespace (causes "Invalid namespace" error)
    let url: string;
    try {
      url = new URL(rawUrl).origin;
    } catch {
      url = rawUrl;
    }

    console.log('[NotificationSocket] Connecting to:', url, '(raw was:', rawUrl, ') userId:', userId);

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(url, {
      auth: { token, userId },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('[NotificationSocket] Connected! socketId:', this.socket?.id, 'userId:', userId);
      // Re-register data event forwarders
      for (const event of this.listeners.keys()) {
        if (!LIFECYCLE_EVENTS.has(event)) this._forward(event);
      }
      // Notify lifecycle listeners
      this._notifyLifecycle('connect', {});
    });

    this.socket.on('connect_error', (err) => {
      console.error('[NotificationSocket] connect_error:', err.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[NotificationSocket] Disconnected, reason:', reason);
      this._notifyLifecycle('disconnect', { reason });
    });

    // Forward known data events immediately
    this._forward('notification.created');
    this._forward('session.status.changed');

    return new Promise<void>((resolve) => {
      this.socket!.once('connect', () => {
        console.log('[NotificationSocket] Promise resolved on connect');
        resolve();
      });
      this.socket!.once('connect_error', (err) => {
        console.warn('[NotificationSocket] Promise resolved on connect_error:', err.message);
        resolve();
      });
      setTimeout(() => {
        console.warn('[NotificationSocket] Promise resolved on 10s timeout');
        resolve();
      }, 10000);
    });
  }

  private _notifyLifecycle(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => { try { cb(data); } catch {} });
    }
  }

  private _forward(event: string): void {
    if (!this.socket) return;
    if (LIFECYCLE_EVENTS.has(event)) return; // Never forward lifecycle events this way
    // Remove any previous forwarder, add fresh one
    this.socket.off(event);
    this.socket.on(event, (data: any) => {
      console.log(`[NotificationSocket] Event received: "${event}"`, data);
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach(cb => { try { cb(data); } catch {} });
      }
    });
  }

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    console.log(`[NotificationSocket] on("${event}") registered, total listeners:`, this.listeners.get(event)!.size);
    // For data events, register/refresh the socket forwarder if socket exists
    if (this.socket && !LIFECYCLE_EVENTS.has(event)) {
      this._forward(event);
    }
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.listeners.clear();
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const notificationSocket = new NotificationSocketService();
