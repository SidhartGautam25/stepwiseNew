export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'SESSION_EXPIRED';

type AuthEventCallback = (event: AuthEvent) => void;

const BROADCAST_CHANNEL_NAME = 'handrail-auth';
const STORAGE_FALLBACK_KEY = 'handrail_auth_sync_event';

class AuthEventBus {
  private inTabListeners = new Set<AuthEventCallback>();
  private channel: BroadcastChannel | null = null;
  private isListening = false;

  constructor() {
    this.initCrossTabListener();
  }

  private initCrossTabListener() {
    if (typeof window === 'undefined') return;

    if ('BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (messageEvent) => {
          if (messageEvent.data && typeof messageEvent.data.type === 'string') {
            this.notifyInTab(messageEvent.data.type as AuthEvent);
          }
        };
      } catch {
        // Fallback to localStorage
      }
    }

    if (!this.channel && !this.isListening) {
      window.addEventListener('storage', (storageEvent) => {
        if (storageEvent.key === STORAGE_FALLBACK_KEY && storageEvent.newValue) {
          try {
            const parsed = JSON.parse(storageEvent.newValue);
            if (parsed && parsed.type) {
              this.notifyInTab(parsed.type as AuthEvent);
            }
          } catch {
            // Ignore malformed storage events
          }
        }
      });
      this.isListening = true;
    }
  }

  private notifyInTab(event: AuthEvent) {
    this.inTabListeners.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.error('Error in auth event listener:', err);
      }
    });
  }

  /**
   * Broadcasts an event to both current-tab subscribers and cross-tab subscribers.
   * Invariant: Events carry NO tokens or sensitive credentials.
   */
  emit(event: AuthEvent) {
    // 1. Notify current tab
    this.notifyInTab(event);

    if (typeof window === 'undefined') return;

    // 2. Notify other tabs via BroadcastChannel or localStorage fallback
    if (this.channel) {
      try {
        this.channel.postMessage({ type: event, timestamp: Date.now() });
      } catch {
        // Fallback below
      }
    } else {
      try {
        // Carry only event type and timestamp, NEVER sensitive data or tokens
        localStorage.setItem(
          STORAGE_FALLBACK_KEY,
          JSON.stringify({ type: event, timestamp: Date.now() }),
        );
      } catch {
        // LocalStorage disabled or quota exceeded
      }
    }
  }

  /**
   * Subscribes a listener to auth state events.
   * Returns an unsubscribe function.
   */
  subscribe(callback: AuthEventCallback): () => void {
    this.inTabListeners.add(callback);
    return () => {
      this.inTabListeners.delete(callback);
    };
  }
}

export const authEvents = new AuthEventBus();

export function emitAuthEvent(event: AuthEvent): void {
  authEvents.emit(event);
}

export function subscribeAuthEvent(callback: (event: AuthEvent) => void): () => void {
  return authEvents.subscribe(callback);
}
