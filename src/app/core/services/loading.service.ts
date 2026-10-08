import { Injectable, NgZone, inject, signal } from '@angular/core';

/**
 * Tracks in-flight HTTP requests to drive the shell progress bar.
 *
 * Why this is a signal and not a plain counter:
 *
 * `loadingInterceptor` calls `start()` **synchronously** when a request is
 * created, and requests are created *during* change detection (the `@if` /
 * `| async` bindings of the page views subscribe as they render). So the
 * counter used to change in the middle of a change-detection pass while the
 * shell template already had `isLoading` bound — which is exactly what
 * NG0100 `ExpressionChangedAfterItHasBeenCheckedError` reports.
 *
 * `NgZone.runOutsideAngular` + `queueMicrotask` pushes the write past the
 * synchronous CD pass, so the flag can only ever change between passes. That
 * costs one extra (cheap) render tick, which is invisible to the user.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly zone = inject(NgZone);
  private pendingRequests = 0;

  /** Only mutate this from outside a change-detection pass. */
  readonly isLoading = signal(false);

  start(): void {
    this.pendingRequests += 1;
    this.scheduleSync();
  }

  stop(): void {
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    this.scheduleSync();
  }

  private scheduleSync(): void {
    const shouldBeLoading = this.pendingRequests > 0;
    // Already in sync — nothing to schedule.
    if (this.isLoading() === shouldBeLoading) return;

    this.zone.runOutsideAngular(() => {
      queueMicrotask(() => this.zone.run(() => this.isLoading.set(shouldBeLoading)));
    });
  }
}