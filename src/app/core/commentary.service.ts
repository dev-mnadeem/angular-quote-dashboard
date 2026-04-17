import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, timer } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Commentary {
  readonly text: string;
  readonly provider: string;
  readonly generatedAt: string;
}

/**
 * Reads the one-sentence board summary from the feed's `/commentary` route.
 *
 * The sentence is generated server-side — by a model when `ANTHROPIC_API_KEY` is
 * set, otherwise by a deterministic summariser — and cached there, so polling it
 * on a timer costs one cheap HTTP round trip regardless of how it was written.
 * If the sidecar is not running the strip simply stays hidden.
 */
@Injectable({ providedIn: 'root' })
export class CommentaryService {
  private readonly http = inject(HttpClient);
  private readonly state = signal<Commentary | null>(null);

  readonly commentary = this.state.asReadonly();

  constructor() {
    timer(0, environment.commentaryRefreshMs)
      .pipe(
        switchMap(() =>
          this.http
            .get<Commentary>(`${environment.apiBase}/commentary`)
            .pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((value) => this.state.set(value));
  }
}
