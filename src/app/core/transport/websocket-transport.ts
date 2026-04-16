import { signal, Signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { FeedMessage, parseFeedMessage } from './feed-message';
import { FeedStatus, QuoteTransport } from './quote-transport';

export interface WebSocketTransportOptions {
  readonly url: string;
  /** First reconnect delay. Each further attempt doubles it, up to the ceiling. */
  readonly baseRetryDelayMs?: number;
  readonly maxRetryDelayMs?: number;
  /** After this many consecutive failures the transport reports itself unreachable. */
  readonly attemptsBeforeGivingUp?: number;
  readonly socketFactory?: (url: string) => WebSocket;
}

const DEFAULTS = {
  baseRetryDelayMs: 500,
  maxRetryDelayMs: 15_000,
  attemptsBeforeGivingUp: 4,
};

/**
 * Reads quotes from the feed's WebSocket.
 *
 * The reconnect is deliberately not a fixed-interval retry: a fixed interval
 * means every client that was connected to a feed that just restarted comes back
 * in the same millisecond. This backs off exponentially and adds jitter, and it
 * caps the delay so a client that was asleep for an hour still recovers quickly.
 */
export class WebSocketQuoteTransport implements QuoteTransport {
  private readonly subject = new Subject<FeedMessage>();
  private readonly state = signal<FeedStatus>('stopped');
  private readonly options: Required<Omit<WebSocketTransportOptions, 'socketFactory'>> & {
    socketFactory: (url: string) => WebSocket;
  };

  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveFailures = 0;
  /**
   * Guards against the close handler of a socket we are replacing scheduling a
   * reconnect for a connection nobody asked for any more.
   */
  private generation = 0;

  readonly messages: Observable<FeedMessage> = this.subject.asObservable();
  readonly status: Signal<FeedStatus> = this.state.asReadonly();
  readonly source: Signal<string>;

  constructor(options: WebSocketTransportOptions) {
    this.options = {
      ...DEFAULTS,
      socketFactory: (url) => new WebSocket(url),
      ...options,
    };
    const label = signal(`live feed · ${this.options.url}`);
    this.source = label.asReadonly();
  }

  connect(): void {
    this.disconnect();
    this.consecutiveFailures = 0;
    this.open();
  }

  disconnect(): void {
    this.generation += 1;
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      // Detach first: otherwise this close fires `onclose` and schedules a
      // reconnect for the connection we are in the middle of tearing down.
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
    }
    this.state.set('stopped');
  }

  private open(): void {
    const generation = this.generation;
    this.state.set(this.consecutiveFailures === 0 ? 'connecting' : 'retrying');

    let socket: WebSocket;
    try {
      socket = this.options.socketFactory(this.options.url);
    } catch {
      this.scheduleRetry(generation);
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (generation !== this.generation) return;
      this.consecutiveFailures = 0;
      this.state.set('live');
    };

    socket.onmessage = (event: MessageEvent) => {
      if (generation !== this.generation) return;
      const message = parseFeedMessage(String(event.data));
      if (message) this.subject.next(message);
    };

    // An `error` is always followed by a `close`, so the reconnect is driven
    // from `close` alone to avoid scheduling two retries for one failure.
    socket.onerror = () => socket.close();

    socket.onclose = () => {
      if (generation !== this.generation) return;
      this.socket = null;
      this.consecutiveFailures += 1;
      this.scheduleRetry(generation);
    };
  }

  private scheduleRetry(generation: number): void {
    if (generation !== this.generation) return;
    this.state.set(
      this.consecutiveFailures >= this.options.attemptsBeforeGivingUp ? 'demo' : 'retrying',
    );
    const exponential =
      this.options.baseRetryDelayMs * 2 ** Math.min(this.consecutiveFailures - 1, 10);
    const capped = Math.min(exponential, this.options.maxRetryDelayMs);
    // Jitter so a fleet of tabs does not stampede a feed that just came back.
    const delay = capped / 2 + Math.random() * (capped / 2);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, delay);
  }
}
