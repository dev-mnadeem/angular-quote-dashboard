import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideQuoteFeed } from './core/feed.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    // Ticks arrive in bursts; coalescing means one change-detection pass per
    // burst rather than one per event.
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch()),
    ...provideQuoteFeed(),
  ],
};
