import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { ThemeService } from './theme.service';

const STORAGE_KEY = 'stock-dashboard.theme';

/** A DOCUMENT stand-in whose location, storage and media query the test controls. */
function fakeDocument(options: {
  search?: string;
  stored?: string | null;
  prefersDark?: boolean;
  throwOnStorage?: boolean;
}): Document {
  const root = document.createElement('html');
  const store = new Map<string, string>();
  if (options.stored) store.set(STORAGE_KEY, options.stored);
  return {
    documentElement: root,
    defaultView: {
      location: { search: options.search ?? '' },
      localStorage: {
        getItem: (k: string) => {
          if (options.throwOnStorage) throw new Error('blocked');
          return store.get(k) ?? null;
        },
        setItem: (k: string, v: string) => {
          if (options.throwOnStorage) throw new Error('blocked');
          store.set(k, v);
        },
      },
      matchMedia: () => ({ matches: options.prefersDark ?? false }),
    },
  } as unknown as Document;
}

function build(doc: Document): ThemeService {
  TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: doc }] });
  const service = TestBed.inject(ThemeService);
  TestBed.flushEffects();
  return service;
}

describe('ThemeService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('takes the theme from the query string first', () => {
    expect(build(fakeDocument({ search: '?theme=dark', stored: 'light' })).theme()).toBe('dark');
  });

  it('ignores an unrecognised query value', () => {
    expect(build(fakeDocument({ search: '?theme=purple', stored: 'light' })).theme()).toBe('light');
  });

  it('falls back to the stored choice', () => {
    expect(build(fakeDocument({ stored: 'dark' })).theme()).toBe('dark');
  });

  it('falls back to the system preference', () => {
    expect(build(fakeDocument({ prefersDark: true })).theme()).toBe('dark');
    TestBed.resetTestingModule();
    expect(build(fakeDocument({ prefersDark: false })).theme()).toBe('light');
  });

  it('writes the theme onto the document element', () => {
    const doc = fakeDocument({ stored: 'dark' });
    build(doc);
    expect(doc.documentElement.dataset['theme']).toBe('dark');
  });

  it('toggles between light and dark', () => {
    const doc = fakeDocument({ stored: 'light' });
    const service = build(doc);
    service.toggle();
    TestBed.flushEffects();
    expect(service.theme()).toBe('dark');
    expect(doc.documentElement.dataset['theme']).toBe('dark');
  });

  it('still works when storage is unavailable', () => {
    const doc = fakeDocument({ throwOnStorage: true, prefersDark: true });
    expect(() => build(doc)).not.toThrow();
    expect(doc.documentElement.dataset['theme']).toBe('dark');
  });
});
