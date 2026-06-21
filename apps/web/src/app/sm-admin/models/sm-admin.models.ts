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
  serviceAccountId: string;
  clientId: string;
  write: boolean;
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

export interface CreateMachineAccountRequest {
  name: string;
  clientSecret: string;
  encryptedPayload: string;
  write: boolean;
}

export interface CreateMachineAccountResponse {
  clientId: string;
  serviceAccountId: string;
}
