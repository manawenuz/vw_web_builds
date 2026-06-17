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
  displayName: string;
}

export interface CreateProjectResponse {
  id: string;
  organizationId: string;
  displayName: string;
  creationDate: string;
}

export interface SecretEntry {
  id: string;
  projectId: string | null;
  creationDate: string;
  revisionDate: string;
}

export interface SecretsListResponse {
  secrets: SecretEntry[];
}
