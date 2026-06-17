import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { OrganizationState, AdminState } from '../models/sm-admin.models';

@Injectable({ providedIn: 'root' })
export class SmStateService {
  private stateSubject = new BehaviorSubject<AdminState | null>(null);
  private selectedOrgSubject = new BehaviorSubject<string | null>(null);

  state$: Observable<AdminState | null> = this.stateSubject.asObservable();
  selectedOrgId$: Observable<string | null> = this.selectedOrgSubject.asObservable();

  get organizations(): OrganizationState[] {
    return this.stateSubject.value?.organizations ?? [];
  }

  get selectedOrg(): OrganizationState | null {
    const id = this.selectedOrgSubject.value;
    if (!id) return null;
    return this.organizations.find(o => o.id === id) ?? null;
  }

  get selectedOrgId(): string | null {
    return this.selectedOrgSubject.value;
  }

  setState(state: AdminState): void {
    this.stateSubject.next(state);
    const orgs = state.organizations ?? [];
    const current = this.selectedOrgSubject.value;
    if (!current || !orgs.find(o => o.id === current)) {
      this.selectedOrgSubject.next(orgs.length > 0 ? orgs[0].id : null);
    }
  }

  selectOrg(orgId: string): void {
    this.selectedOrgSubject.next(orgId);
  }
}
