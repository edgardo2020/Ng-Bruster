import { Injectable } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pendingRequestsSubject = new BehaviorSubject(0);

  readonly isLoading$ = this.pendingRequestsSubject.asObservable().pipe(map((pending) => pending > 0));

  start(): void {
    this.pendingRequestsSubject.next(this.pendingRequestsSubject.value + 1);
  }

  stop(): void {
    const nextValue = Math.max(0, this.pendingRequestsSubject.value - 1);
    this.pendingRequestsSubject.next(nextValue);
  }
}