export interface AdminState {
  organizations: OrganizationState[];
}

export interface OrganizationState {
  id: string;
  displayName: string;
  machineAccounts: MachineAccount[];
  projects: ProjectState[];
  secretCount: number;
}

export interface MachineAccount {
  id: string;
  name: string;
  allProjects: boolean;
  projectCount: number;
  tokenCount: number;
}

export interface ProjectState {
  id: string;
  name?: string;
  displayName: string;
  creationDate: string;
}

export interface ProvisionRequest {
  orgName: string;
  project: string;
  secrets?: Record<string, string>;
  readOnly?: boolean;
}

export interface ProvisionResponse {
  accessToken: string;
  projectId: string;
  orgId: string;
  secretCount: number;
}

export interface CreateProjectRequest {
  displayName?: string;
  name?: string;
}

export interface CreateProjectResponse {
  id: string;
  organizationId: string;
  name?: string;
  displayName: string;
  creationDate: string;
  revisionDate?: string;
}

export interface SecretEntry {
  id: string;
  projectId: string | null;
  key?: string;
  value?: string;
  note?: string;
  creationDate: string;
  revisionDate: string;
}

export interface SecretsListResponse {
  secrets: SecretEntry[];
}

export interface OrgUserKeyResponse {
  organizationId: string;
  userId: string;
  encryptedOrgKey: string | null;
  revisionDate: string | null;
}

export interface MachineAccountEnvelopeResponse {
  clientId: string;
  encryptedPayload: string;
}

export interface SecretWriteRequest {
  key: string;
  value: string;
  note?: string;
  projectIds?: string[];
}

export interface SecretResponse extends SecretEntry {
  organizationId: string;
}

export interface EncryptedProvisionRequest {
  orgName: string;
  encryptedOrgKey: string;
  project: {
    name: string;
    displayName?: string;
  };
  machineAccount: {
    clientSecret: string;
    encryptedPayload: string;
    write?: boolean;
  };
  secrets?: SecretWriteRequest[];
}

export interface EncryptedProvisionResponse {
  orgId: string;
  projectId: string;
  clientId: string;
  serviceAccountId: string;
  secretCount: number;
}

export interface DeleteOrganizationResponse {
  deletedOrganizationId: string;
  deleted: {
    organizations: number;
    accessTokens: number;
    orgUserKeys: number;
    secrets: number;
    projects: number;
  };
}

export interface UpdateProjectRequest {
  displayName?: string;
  name?: string;
}

export interface UpdateProjectResponse {
  id: string;
  organizationId: string;
  name?: string;
  displayName: string;
  creationDate: string;
  revisionDate?: string;
}

// ── Machine account detail ────────────────────────────────────────────────────

export interface MachineAccountDetail {
  id: string;
  name: string;
  allProjects: boolean;
}

export interface CreateMachineAccountV2Request {
  name: string;
}

export interface CreateMachineAccountV2Response {
  id: string;
}

export interface UpdateMachineAccountRequest {
  name?: string;
  allProjects?: boolean;
}

export interface UpdateMachineAccountResponse {
  id: string;
  name: string;
  allProjects: boolean;
}

export interface MachineAccountProjectGrant {
  projectId: string;
  write: boolean;
}

export interface MachineAccountProjectGrantListItem {
  projectId: string;
  write: boolean;
}

export interface SetMachineAccountProjectsRequest {
  projects: MachineAccountProjectGrant[];
}

export interface ProjectMachineAccountGrant {
  machineAccountId: string;
  write: boolean;
}

export interface ProjectMachineAccountListItem {
  machineAccountId: string;
  name: string;
  write: boolean;
}

export interface SetProjectMachineAccountsRequest {
  machineAccounts: ProjectMachineAccountGrant[];
}

export interface SecretMachineAccountGrant {
  machineAccountId: string;
  write: boolean;
}

export interface SecretMachineAccountListItem {
  machineAccountId: string;
  name: string;
  write: boolean;
}

export interface SetSecretMachineAccountsRequest {
  machineAccounts: SecretMachineAccountGrant[];
}

// ── Access tokens ─────────────────────────────────────────────────────────────

export interface AccessTokenListItem {
  clientId: string;
  name: string;
  expiresAt: string | null;
  creationDate: string;
}

export interface CreateAccessTokenRequest {
  name: string;
  expiresAt: string | null;
  clientSecret: string;
  encryptedPayload: string;
  write: boolean;
}

export interface CreateAccessTokenResponse {
  clientId: string;
  serviceAccountId: string;
}

// ── Audit events ──────────────────────────────────────────────────────────────

export interface AuditEvent {
  ts: string;
  actorType: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  detail: string;
}

export interface AuditEventsResponse {
  events: AuditEvent[];
}
