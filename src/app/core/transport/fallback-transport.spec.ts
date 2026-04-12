import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { FallbackQuoteTransport } from './fallback-transport';
import { FeedMessage } from './feed-message';
import { FeedStatus, QuoteTransport } from './quote-transport';

class StubTransport implements QuoteTransport {
  readonly subject = new Subject<FeedMessage>();
  readonly messages = this.subject.asObservable();
  readonly state = signal<FeedStatus>('stopped');
  readonly status = this.state.asReadonly();
  readonly label = signal('stub');
  readonly source = this.label.asReadonly();
  connects = 0;
  disconnects = 0;

  constructor(private readonly name: string) {
    this.label.set(name);
  }

  connect(): void {
    this.connects += 1;
  }

  disconnect(): void {
    this.disconnects += 1;
  }
}

describe('FallbackQuoteTransport', () => {
  let primary: StubTransport;
  let backup: StubTransport;
  let injector: Injector;
  let transport: FallbackQuoteTransport;

  beforeEach(() => {
    primary = new StubTransport('live feed');
    backup = new StubTransport('demo generator');
    TestBed.configureTestingModule({});
    injector = TestBed.inject(Injector);
    runInInjectionContext(injector, () => {
      transport = new FallbackQuoteTransport(primary, backup, injector);
    });
  });

  /** The composite reacts through an effect, so flush it before asserting. */
  function settle(): void {
    TestBed.flushEffects();
  }

  it('connects only the primary', () => {
    transport.connect();
    expect(primary.connects).toBe(1);
    expect(backup.connects).toBe(0);
  });

  it('mirrors the primary status while it is reachable', () => {
    primary.state.set('live');
    settle();
    expect(transport.status()).toBe('live');
    expect(transport.source()).toBe('live feed');
  });

  it('starts the backup once the primary gives up', () => {
    primary.state.set('demo');
    settle();
    expect(backup.connects).toBe(1);
  });

  it('reports the backup as the source while it is running', () => {
    primary.state.set('demo');
    backup.state.set('demo');
    settle();
    expect(transport.status()).toBe('demo');
    expect(transport.source()).toBe('demo generator');
  });

  it('stops the backup when the primary recovers', () => {
    primary.state.set('demo');
    settle();
    primary.state.set('live');
    settle();
    expect(backup.disconnects).toBe(1);
    expect(transport.status()).toBe('live');
  });

  it('does not start the backup twice for a sustained outage', () => {
    primary.state.set('demo');
    settle();
    primary.state.set('demo');
    settle();
    expect(backup.connects).toBe(1);
  });

  it('forwards frames from whichever transport emits them', () => {
    const seen: string[] = [];
    transport.messages.subscribe((m) => seen.push(m.type));
    primary.subject.next({ type: 'tick', sequence: 1, quotes: [] });
    backup.subject.next({ type: 'snapshot', sequence: 1, provider: 'x', quotes: [], history: {} });
    expect(seen).toEqual(['tick', 'snapshot']);
  });

  it('disconnects both transports', () => {
    transport.disconnect();
    expect(primary.disconnects).toBe(1);
    expect(backup.disconnects).toBe(1);
  });
});
