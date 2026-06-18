/* eslint-disable no-console */
import { Injectable } from "@angular/core";

import {
  AdminState,
  ProvisionRequest,
  ProvisionResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  EncryptedProvisionRequest,
  EncryptedProvisionResponse,
  OrgUserKeyResponse,
  SecretResponse,
  SecretWriteRequest,
  SecretsListResponse,
} from "../models/sm-admin.models";

@Injectable({ providedIn: "root" })
export class SmAdminService {
  private headers(contentType = false): HeadersInit {
    const h: Record<string, string> = {
      Accept: "application/json",
    };
    if (contentType) {
      h["Content-Type"] = "application/json";
    }
    return h;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    console.log(`[sm-admin:api] ${method} ${path}`);
    const response = await fetch(path, {
      method,
      headers: this.headers(body !== undefined),
      credentials: "same-origin",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    console.log(`[sm-admin:api] ${method} ${path} response`, response.status);
    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(`${response.status} ${response.statusText}: ${text}`);
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async establishAdminSession(accessToken: string): Promise<void> {
    await this.request<void>("POST", "/_admin/session", { accessToken });
  }

  async clearAdminSession(): Promise<void> {
    await this.request<void>("DELETE", "/_admin/session");
  }

  async fetchState(): Promise<AdminState> {
    return this.request<AdminState>("GET", "/_admin/state");
  }

  async provision(req: ProvisionRequest): Promise<ProvisionResponse> {
    return this.request<ProvisionResponse>("POST", "/_admin/provision", req);
  }

  async provisionEncrypted(req: EncryptedProvisionRequest): Promise<EncryptedProvisionResponse> {
    return this.request<EncryptedProvisionResponse>("POST", "/_admin/provision-encrypted", req);
  }

  async getOrgUserKey(orgId: string): Promise<OrgUserKeyResponse> {
    return this.request<OrgUserKeyResponse>("GET", `/_admin/orgs/${orgId}/key`);
  }

  async setOrgUserKey(orgId: string, encryptedOrgKey: string): Promise<OrgUserKeyResponse> {
    return this.request<OrgUserKeyResponse>("PUT", `/_admin/orgs/${orgId}/key`, {
      encryptedOrgKey,
    });
  }

  async createProject(orgId: string, req: CreateProjectRequest): Promise<CreateProjectResponse> {
    return this.request<CreateProjectResponse>("POST", `/_admin/orgs/${orgId}/projects`, req);
  }

  async deleteProject(orgId: string, projectId: string): Promise<void> {
    await this.request<void>("DELETE", `/_admin/orgs/${orgId}/projects/${projectId}`);
  }

  async revokeToken(orgId: string, clientId: string): Promise<void> {
    await this.request<void>("DELETE", `/_admin/orgs/${orgId}/machine-accounts/${clientId}`);
  }

  async listSecrets(orgId: string): Promise<SecretsListResponse> {
    return this.request<SecretsListResponse>("GET", `/_admin/orgs/${orgId}/secrets`);
  }

  async createSecret(orgId: string, req: SecretWriteRequest): Promise<SecretResponse> {
    return this.request<SecretResponse>("POST", `/_admin/orgs/${orgId}/secrets`, req);
  }

  async updateSecret(
    orgId: string,
    secretId: string,
    req: SecretWriteRequest,
  ): Promise<SecretResponse> {
    return this.request<SecretResponse>("PUT", `/_admin/orgs/${orgId}/secrets/${secretId}`, req);
  }

  async deleteSecrets(orgId: string, ids: string[]): Promise<{ deletedSecretIds: string[] }> {
    return this.request<{ deletedSecretIds: string[] }>(
      "POST",
      `/_admin/orgs/${orgId}/secrets/delete`,
      ids,
    );
  }
}
