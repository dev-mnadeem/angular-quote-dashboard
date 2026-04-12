import { WebSocketQuoteTransport } from './websocket-transport';

/** Minimal stand-in for a browser WebSocket, driven by the test. */
class FakeSocket {
  static created: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeSocket.created.push(this);
  }

  close(): void {
    this.closed = true;
    this.onclose?.();
  }

  open(): void {
    this.onopen?.();
  }

  deliver(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }
}

const quote = {
  symbol: 'AAPL',
  name: 'Apple',
  current: 178,
  dayHigh: 179,
  dayLow: 177,
  week52High: 200,
  week52Low: 150,
  previousClose: 178,
  change: 0,
  changePercent: 0,
  asOf: '2024-06-17T12:00:00.000Z',
};

function build(overrides: Record<string, unknown> = {}): WebSocketQuoteTransport {
  return new WebSocketQuoteTransport({
    url: 'ws://localhost:7202/stream',
    baseRetryDelayMs: 10,
    maxRetryDelayMs: 40,
    attemptsBeforeGivingUp: 2,
    socketFactory: (url) => new FakeSocket(url) as unknown as WebSocket,
    ...overrides,
  });
}

describe('WebSocketQuoteTransport', () => {
  beforeEach(() => {
    FakeSocket.created = [];
    jasmine.clock().install();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('starts stopped and opens one socket on connect', () => {
    const transport = build();
    expect(transport.status()).toBe('stopped');
    transport.connect();
    expect(FakeSocket.created.length).toBe(1);
    expect(transport.status()).toBe('connecting');
    transport.disconnect();
  });

  it('reports live once the socket opens', () => {
    const transport = build();
    transport.connect();
    FakeSocket.created[0].open();
    expect(transport.status()).toBe('live');
    transport.disconnect();
  });

  it('emits parsed frames', () => {
    const transport = build();
    const seen: unknown[] = [];
    transport.messages.subscribe((m) => seen.push(m));
    transport.connect();
    FakeSocket.created[0].open();
    FakeSocket.created[0].deliver({ type: 'tick', sequence: 1, quotes: [quote] });
    expect(seen.length).toBe(1);
    transport.disconnect();
  });

  it('drops a malformed frame without ending the stream', () => {
    const transport = build();
    const seen: unknown[] = [];
    let errored = false;
    transport.messages.subscribe({ next: (m) => seen.push(m), error: () => (errored = true) });
    transport.connect();
    const socket = FakeSocket.created[0];
    socket.open();
    socket.onmessage?.({ data: 'not json' } as MessageEvent);
    socket.deliver({ type: 'tick', sequence: 1, quotes: [quote] });
    expect(errored).toBeFalse();
    expect(seen.length).toBe(1);
    transport.disconnect();
  });

  it('reconnects after a drop', () => {
    const transport = build();
    transport.connect();
    FakeSocket.created[0].open();
    FakeSocket.created[0].close();
    expect(transport.status()).toBe('retrying');
    jasmine.clock().tick(100);
    expect(FakeSocket.created.length).toBe(2);
    transport.disconnect();
  });

  it('backs off: each further failure waits longer than the last', () => {
    const transport = build({ baseRetryDelayMs: 100, maxRetryDelayMs: 10_000 });
    transport.connect();
    FakeSocket.created[0].close();
    // First retry is scheduled somewhere in [50, 100).
    jasmine.clock().tick(40);
    expect(FakeSocket.created.length).toBe(1);
    jasmine.clock().tick(70);
    expect(FakeSocket.created.length).toBe(2);

    FakeSocket.created[1].close();
    // Second retry doubles the window, so 110ms is no longer enough.
    jasmine.clock().tick(90);
    expect(FakeSocket.created.length).toBe(2);
    jasmine.clock().tick(150);
    expect(FakeSocket.created.length).toBe(3);
    transport.disconnect();
  });

  it('falls back to demo status after the configured number of failures', () => {
    const transport = build({ attemptsBeforeGivingUp: 2 });
    transport.connect();
    FakeSocket.created[0].close();
    expect(transport.status()).toBe('retrying');
    jasmine.clock().tick(100);
    FakeSocket.created[1].close();
    expect(transport.status()).toBe('demo');
    transport.disconnect();
  });

  it('recovers to live when the feed comes back', () => {
    const transport = build({ attemptsBeforeGivingUp: 1 });
    transport.connect();
    FakeSocket.created[0].close();
    expect(transport.status()).toBe('demo');
    jasmine.clock().tick(100);
    FakeSocket.created[1].open();
    expect(transport.status()).toBe('live');
    transport.disconnect();
  });

  it('does not schedule a reconnect for a socket it is replacing', () => {
    const transport = build();
    transport.connect();
    const first = FakeSocket.created[0];
    first.open();
    transport.connect();
    // The first socket's close must not add a third socket on top of the second.
    jasmine.clock().tick(500);
    expect(FakeSocket.created.length).toBe(2);
    transport.disconnect();
  });

  it('stops retrying once disconnected', () => {
    const transport = build();
    transport.connect();
    FakeSocket.created[0].close();
    transport.disconnect();
    jasmine.clock().tick(5000);
    expect(FakeSocket.created.length).toBe(1);
    expect(transport.status()).toBe('stopped');
  });

  it('survives a socket factory that throws', () => {
    let attempts = 0;
    const transport = new WebSocketQuoteTransport({
      url: 'ws://nope',
      baseRetryDelayMs: 10,
      maxRetryDelayMs: 20,
      attemptsBeforeGivingUp: 1,
      socketFactory: () => {
        attempts += 1;
        throw new Error('blocked');
      },
    });
    expect(() => transport.connect()).not.toThrow();
    jasmine.clock().tick(100);
    expect(attempts).toBeGreaterThan(1);
    transport.disconnect();
  });

  it('caps the retry delay', () => {
    const transport = build({ baseRetryDelayMs: 1000, maxRetryDelayMs: 50 });
    transport.connect();
    FakeSocket.created[0].close();
    jasmine.clock().tick(60);
    expect(FakeSocket.created.length).toBe(2);
    transport.disconnect();
  });
});
