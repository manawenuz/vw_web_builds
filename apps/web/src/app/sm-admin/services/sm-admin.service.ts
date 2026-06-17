import { Injectable } from '@angular/core';
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
  private get token(): string | null {
    return (window as any).__BWS_VAULT_JWT__ ?? null;
  }

  private headers(contentType = false): HeadersInit {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    };
    if (contentType) {
      h['Content-Type'] = 'application/json';
    }
    return h;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(path, {
      method,
      headers: this.headers(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      throw new Error(`${response.status} ${response.statusText}: ${text}`);
    }
    return (await response.json()) as T;
  }

  async fetchState(): Promise<AdminState> {
    return this.request<AdminState>('GET', '/_admin/state');
  }

  async provision(req: ProvisionRequest): Promise<ProvisionResponse> {
    return this.request<ProvisionResponse>('POST', '/_admin/provision', req);
  }

  async createProject(orgId: string, req: CreateProjectRequest): Promise<CreateProjectResponse> {
    return this.request<CreateProjectResponse>('POST', `/_admin/orgs/${orgId}/projects`, req);
  }

  async deleteProject(orgId: string, projectId: string): Promise<void> {
    await this.request<void>('DELETE', `/_admin/orgs/${orgId}/projects/${projectId}`);
  }

  async revokeToken(orgId: string, clientId: string): Promise<void> {
    await this.request<void>('DELETE', `/_admin/orgs/${orgId}/machine-accounts/${clientId}`);
  }

  async listSecrets(orgId: string): Promise<SecretsListResponse> {
    return this.request<SecretsListResponse>('GET', `/_admin/orgs/${orgId}/secrets`);
  }
}
