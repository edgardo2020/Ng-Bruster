import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, combineLatest, map, Observable, of, take, tap } from 'rxjs';

import { QueryParams, ResourceState, UserRecord } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';
import { UsersApiService } from './users-api.service';

@Injectable({ providedIn: 'root' })
export class UsersStore {
  private readonly stateSubject = new BehaviorSubject<ResourceState<UserRecord[]>>({ data: [], loading: false, error: null });
  private readonly filtersSubject = new BehaviorSubject<QueryParams>({ search: '', idRol: 'All', status: 'All' });

  readonly vm$ = combineLatest([this.stateSubject.asObservable(), this.filtersSubject.asObservable()]).pipe(
    map(([state, filters]) => ({
      ...state,
      filtered: state.data.filter((user) => {
        const matchesSearch = !filters.search || `${user.nombre} ${user.Correo}`.toLowerCase().includes(filters.search.toLowerCase());
        const matchesRole = !filters.idRol || filters.idRol === 'All' || user.idRol === filters.idRol;
        const matchesStatus = !filters.status || filters.status === 'All' || user.membershipStatus === filters.status;
        return matchesSearch && matchesRole && matchesStatus;
      })
    }))
  );

  constructor(
    private readonly api: UsersApiService,
    private readonly authService: AuthService
  ) {}

  load(): void {
    const empresaId = this.authService.snapshot?.user.idEmpresa;
    if (!empresaId) {
      this.stateSubject.next({ data: [], loading: false, error: 'No se encontro idEmpresa en la sesion.' });
      return;
    }

    this.stateSubject.next({ ...this.stateSubject.value, loading: true, error: null });

    this.api
      .getByEmpresa(empresaId)
      .pipe(
        take(1),
        catchError((error: unknown) => {
          const message = error instanceof Error ? error.message : 'No se pudieron cargar los clientes.';
          this.stateSubject.next({ data: [], loading: false, error: message });
          return of([]);
        })
      )
      .subscribe((data) => this.stateSubject.next({ data, loading: false, error: null }));
  }

  updateFilters(filters: Partial<QueryParams>): void {
    this.filtersSubject.next({ ...this.filtersSubject.value, ...filters });
  }

  create(payload: UserRecord): Observable<UserRecord> {
    return this.api.create(payload).pipe(tap(() => this.load()));
  }

  update(payload: UserRecord): Observable<UserRecord> {
    return this.api.update(payload).pipe(tap(() => this.load()));
  }

  remove(payload: UserRecord): Observable<void> {
    return this.api.remove(payload).pipe(tap(() => this.load()));
  }
}