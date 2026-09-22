/**
 * Singleton socket for notifications-service.
 * Replaces the ad-hoc io() calls in Header.tsx.
 * Used by Header (notification.created) and NextExam/SessionsList (session.status.changed).
 *
 * The server authenticates the handshake by verifying the access token
 * (see notifications-service/src/services/socket.service.ts) and derives the
 * room (`user:<id>`) from the token itself — it no longer trusts a `userId`
 * the client hands it directly. Since the "one person, one id" merge, the
 * JWT's `userId` claim already IS the candidate id for students too, so the
 * separate `/candidates/by-auth-user/` lookup this used to do before
 * connecting is no longer needed.
 */
import { authSDK } from '@/services/sdk-simple-auth';
import { io, Socket } from 'socket.io-client';
import { NOTIFICATION_WS_URL } from '@/lib/serviceUrls';

type EventCallback = (data: any) => void;

// Events that are Socket.IO lifecycle events — NOT forwarded via _forward()
const LIFECYCLE_EVENTS = new Set(['connect', 'disconnect']);

class NotificationSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private connectPromise: Promise<void> | null = null;
  // Avoid spamming the console on every automatic reconnection attempt while
  // the token is stale/invalid — log the first one, stay quiet after that
  // until a connection actually succeeds.
  private loggedConnectError = false;
  // The user id the current socket is authenticated as. Used so connect()
  // can tell "already connected for this user, no-op" apart from "connected
  // as a different (stale) user, must reconnect" — e.g. logging out and
  // back in as someone else without a full page reload.
  private connectedUserId: string | null = null;

  async connect(): Promise<void> {
    const currentUser = authSDK.getCurrentUser();

    if (this.socket?.connected) {
      if (currentUser && String(currentUser.id) === String(this.connectedUserId)) {
        console.log('[NotificationSocket] connect() called but already connected for this user');
        return;
      }
      console.log('[NotificationSocket] connect() called but connected user changed — reconnecting');
      // Fall through: _doConnect() below disconnects the stale socket and
      // opens a fresh one authenticated as the current user.
    } else if (this.connectPromise) {
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

    this.connectedUserId = String(currentUser.id);

    const rawUrl =
      NOTIFICATION_WS_URL;

    // Socket.IO uses the origin only — strip any path like /api/v1 to avoid
    // treating it as a namespace (causes "Invalid namespace" error)
    let url: string;
    try {
      url = new URL(rawUrl).origin;
    } catch {
      url = rawUrl;
    }

    console.log('[NotificationSocket] Connecting to:', url);

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(url, {
      // A function (not a plain object) so every reconnection attempt —
      // automatic backoff retries included — fetches whatever access token
      // is current at that moment, instead of replaying the token captured
      // at construction time. This is what makes a post-refresh reconnect
      // pick up the new token without any extra wiring here.
      auth: (cb) => cb({ token: authSDK.getAccessToken() }),
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('[NotificationSocket] Connected! socketId:', this.socket?.id);
      this.loggedConnectError = false;
      // Re-register data event forwarders
      for (const event of this.listeners.keys()) {
        if (!LIFECYCLE_EVENTS.has(event)) this._forward(event);
      }
      // Notify lifecycle listeners
      this._notifyLifecycle('connect', {});
    });

    this.socket.on('connect_error', (err) => {
      if (!this.loggedConnectError) {
        this.loggedConnectError = true;
        console.error('[NotificationSocket] connect_error:', err.message, '— will keep retrying via built-in reconnection.');
      }
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
    this.connectedUserId = null;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const notificationSocket = new NotificationSocketService();
