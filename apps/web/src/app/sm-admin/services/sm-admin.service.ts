import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminState,
  ProvisionRequest,
  ProvisionResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  SecretsListResponse,
} from '../models/sm-admin.models';

@Injectable({ providedIn: 'root' })
export class SmAdminService {
  constructor(private http: HttpClient) {}

  private get token(): string | null {
    return (window as any).__BWS_VAULT_JWT__ ?? null;
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    });
  }

  async fetchState(): Promise<AdminState> {
    return firstValueFrom(
      this.http.get<AdminState>('/_admin/state', { headers: this.headers() }),
    );
  }

  async provision(req: ProvisionRequest): Promise<ProvisionResponse> {
    return firstValueFrom(
      this.http.post<ProvisionResponse>('/_admin/provision', req, {
        headers: new HttpHeaders({
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
      }),
    );
  }

  async createProject(orgId: string, req: CreateProjectRequest): Promise<CreateProjectResponse> {
    return firstValueFrom(
      this.http.post<CreateProjectResponse>(`/_admin/orgs/${orgId}/projects`, req, {
        headers: new HttpHeaders({
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
      }),
    );
  }

  async deleteProject(orgId: string, projectId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`/_admin/orgs/${orgId}/projects/${projectId}`, {
        headers: this.headers(),
      }),
    );
  }

  async revokeToken(orgId: string, clientId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`/_admin/orgs/${orgId}/machine-accounts/${clientId}`, {
        headers: this.headers(),
      }),
    );
  }

  async listSecrets(orgId: string): Promise<SecretsListResponse> {
    return firstValueFrom(
      this.http.get<SecretsListResponse>(`/_admin/orgs/${orgId}/secrets`, {
        headers: this.headers(),
      }),
    );
  }
}
