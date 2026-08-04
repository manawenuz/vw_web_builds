/* eslint-disable no-console */
import { Injectable } from "@angular/core";

import {
  AccessTokenListItem,
  AdminState,
  AuditEventsResponse,
  CreateAccessTokenRequest,
  CreateAccessTokenResponse,
  CreateMachineAccountV2Request,
  CreateMachineAccountV2Response,
  DeleteOrganizationResponse,
  EncryptedProvisionRequest,
  EncryptedProvisionResponse,
  MachineAccountEnvelopeResponse,
  MachineAccountProjectGrantListItem,
  OrgUserKeyResponse,
  ProjectMachineAccountListItem,
  ProvisionRequest,
  ProvisionResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  SecretMachineAccountListItem,
  SecretResponse,
  SecretWriteRequest,
  SecretsListResponse,
  SetMachineAccountProjectsRequest,
  SetProjectMachineAccountsRequest,
  SetSecretMachineAccountsRequest,
  UpdateMachineAccountRequest,
  UpdateMachineAccountResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
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
      throw new Error(await this.responseErrorMessage(response));
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  private async responseErrorMessage(response: Response): Promise<string> {
    const text = await response.text().catch(() => "");
    const trimmed = text.trim();
    const contentType = response.headers.get("content-type") ?? "";
    const prefix = `${response.status} ${response.statusText || "Request failed"}`;

    if (contentType.includes("application/json") && trimmed) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        const message = parsed["message"] ?? parsed["error"] ?? parsed["error_description"];
        if (typeof message === "string" && message.trim()) {
          return `${prefix}: ${message}`;
        }
      } catch {
        // Fall through to the concise text handling below.
      }
    }

    if (/^<(?:!doctype\s+html|html)\b/i.test(trimmed)) {
      return `${prefix}: Secrets Manager admin endpoint was not found. Check that the Vaultwarden image and BWS sidecar are both updated.`;
    }

    return trimmed ? `${prefix}: ${trimmed.slice(0, 500)}` : prefix;
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

  async getMachineAccountEnvelope(
    orgId: string,
    clientId: string,
  ): Promise<MachineAccountEnvelopeResponse> {
    return this.request<MachineAccountEnvelopeResponse>(
      "GET",
      `/_admin/orgs/${orgId}/machine-accounts/${clientId}/envelope`,
    );
  }

  async deleteOrganization(orgId: string): Promise<DeleteOrganizationResponse> {
    return this.request<DeleteOrganizationResponse>("DELETE", `/_admin/orgs/${orgId}`);
  }

  async createProject(orgId: string, req: CreateProjectRequest): Promise<CreateProjectResponse> {
    return this.request<CreateProjectResponse>("POST", `/_admin/orgs/${orgId}/projects`, req);
  }

  async deleteProject(orgId: string, projectId: string): Promise<void> {
    await this.request<void>("DELETE", `/_admin/orgs/${orgId}/projects/${projectId}`);
  }

  async updateProject(
    orgId: string,
    projectId: string,
    req: UpdateProjectRequest,
  ): Promise<UpdateProjectResponse> {
    return this.request<UpdateProjectResponse>(
      "PUT",
      `/_admin/orgs/${orgId}/projects/${projectId}`,
      req,
    );
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

  // ── Machine accounts (new multi-MA model) ────────────────────────────────────

  async createMachineAccountV2(
    orgId: string,
    req: CreateMachineAccountV2Request,
  ): Promise<CreateMachineAccountV2Response> {
    return this.request<CreateMachineAccountV2Response>(
      "POST",
      `/_admin/orgs/${orgId}/machine-accounts`,
      req,
    );
  }

  async updateMachineAccount(
    orgId: string,
    maId: string,
    req: UpdateMachineAccountRequest,
  ): Promise<UpdateMachineAccountResponse> {
    return this.request<UpdateMachineAccountResponse>(
      "PUT",
      `/_admin/orgs/${orgId}/machine-accounts/${maId}`,
      req,
    );
  }

  async deleteMachineAccount(orgId: string, maId: string): Promise<{ deletedId: string }> {
    return this.request<{ deletedId: string }>(
      "DELETE",
      `/_admin/orgs/${orgId}/machine-accounts/${maId}`,
    );
  }

  async getMachineAccountProjects(
    orgId: string,
    maId: string,
  ): Promise<MachineAccountProjectGrantListItem[]> {
    return this.request<MachineAccountProjectGrantListItem[]>(
      "GET",
      `/_admin/orgs/${orgId}/machine-accounts/${maId}/projects`,
    );
  }

  async setMachineAccountProjects(
    orgId: string,
    maId: string,
    req: SetMachineAccountProjectsRequest,
  ): Promise<void> {
    await this.request<void>(
      "PUT",
      `/_admin/orgs/${orgId}/machine-accounts/${maId}/projects`,
      req,
    );
  }

  // ── Access tokens per MA ──────────────────────────────────────────────────────

  async listAccessTokens(orgId: string, maId: string): Promise<AccessTokenListItem[]> {
    return this.request<AccessTokenListItem[]>(
      "GET",
      `/_admin/orgs/${orgId}/machine-accounts/${maId}/access-tokens`,
    );
  }

  async createAccessToken(
    orgId: string,
    maId: string,
    req: CreateAccessTokenRequest,
  ): Promise<CreateAccessTokenResponse> {
    return this.request<CreateAccessTokenResponse>(
      "POST",
      `/_admin/orgs/${orgId}/machine-accounts/${maId}/access-tokens`,
      req,
    );
  }

  async revokeAccessToken(
    orgId: string,
    maId: string,
    clientId: string,
  ): Promise<{ revokedClientId: string }> {
    return this.request<{ revokedClientId: string }>(
      "DELETE",
      `/_admin/orgs/${orgId}/machine-accounts/${maId}/access-tokens/${clientId}`,
    );
  }

  // ── Project ↔ MA grants ────────────────────────────────────────────────────────

  async getProjectMachineAccounts(
    orgId: string,
    projectId: string,
  ): Promise<ProjectMachineAccountListItem[]> {
    return this.request<ProjectMachineAccountListItem[]>(
      "GET",
      `/_admin/orgs/${orgId}/projects/${projectId}/machine-accounts`,
    );
  }

  async setProjectMachineAccounts(
    orgId: string,
    projectId: string,
    req: SetProjectMachineAccountsRequest,
  ): Promise<void> {
    await this.request<void>(
      "PUT",
      `/_admin/orgs/${orgId}/projects/${projectId}/machine-accounts`,
      req,
    );
  }

  // ── Secret ↔ MA grants ─────────────────────────────────────────────────────────

  async getSecretMachineAccounts(
    orgId: string,
    secretId: string,
  ): Promise<SecretMachineAccountListItem[]> {
    return this.request<SecretMachineAccountListItem[]>(
      "GET",
      `/_admin/orgs/${orgId}/secrets/${secretId}/machine-accounts`,
    );
  }

  async setSecretMachineAccounts(
    orgId: string,
    secretId: string,
    req: SetSecretMachineAccountsRequest,
  ): Promise<void> {
    await this.request<void>(
      "PUT",
      `/_admin/orgs/${orgId}/secrets/${secretId}/machine-accounts`,
      req,
    );
  }

  // ── Audit events ──────────────────────────────────────────────────────────────

  async getAuditEvents(
    orgId: string,
    from: string,
    to: string,
  ): Promise<AuditEventsResponse> {
    return this.request<AuditEventsResponse>(
      "GET",
      `/_admin/orgs/${orgId}/audit?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
  }
}
