import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, timer } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FeedMetrics {
  readonly uptimeSeconds: number;
  readonly sequence: number;
  readonly polls: number;
  readonly failures: number;
  readonly lastError: string | null;
  readonly clients: number;
  readonly framesSent: number;
  readonly clientsDropped: number;
}

/** How often the footer refreshes its view of the feed process. */
const REFRESH_MS = 10_000;

/**
 * Polls the feed's `/metrics` route. A dashboard that reports its own backend's
 * health is a dashboard you can debug without opening a terminal, which matters
 * for the one failure mode that otherwise looks like success: a feed that is up
 * but has stopped polling.
 */
@Injectable({ providedIn: 'root' })
export class FeedMetricsService {
  private readonly http = inject(HttpClient);
  private readonly state = signal<FeedMetrics | null>(null);

  readonly metrics = this.state.asReadonly();

  constructor() {
    timer(0, REFRESH_MS)
      .pipe(
        switchMap(() =>
          this.http
            .get<FeedMetrics>(`${environment.apiBase}/metrics`)
            .pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((value) => this.state.set(value));
  }
}
