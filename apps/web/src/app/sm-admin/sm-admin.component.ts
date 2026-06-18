/* eslint-disable no-console, @bitwarden/components/enforce-readonly-angular-properties */
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { firstValueFrom, timeout, take } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";

import {
  OrganizationState,
  ProvisionRequest,
  ProvisionResponse,
  SecretEntry,
} from "./models/sm-admin.models";
import { SmAdminService } from "./services/sm-admin.service";
import { SmStateService } from "./services/sm-state.service";

type Section = "overview" | "projects" | "secrets" | "machine-accounts" | "provision" | "settings";

@Component({
  selector: "app-sm-admin",
  templateUrl: "./sm-admin.component.html",
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-background, #1a2332);
        color: var(--color-text, #dce8f8);
        font-family: inherit;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .sm-loading,
      .sm-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 3rem;
        height: 100%;
        color: var(--color-text-muted, #7a92b0);
      }
      .sm-error button {
        padding: 6px 16px;
        border: 1px solid var(--color-border, rgba(255, 255, 255, 0.12));
        border-radius: 4px;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
      .sm-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid rgba(255, 255, 255, 0.12);
        border-top-color: var(--color-primary, #175ddc);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .sm-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 24px;
        border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
      }
      .sm-topbar-title {
        display: flex;
        flex-direction: column;
      }
      .sm-org-name {
        font-size: 16px;
        font-weight: 600;
      }
      .sm-org-id {
        font-size: 11px;
        color: var(--color-text-muted, #7a92b0);
        font-family: monospace;
      }
      .sm-topbar-actions {
        display: flex;
        gap: 8px;
      }
      .sm-content-wrap {
        display: flex;
        flex: 1;
        overflow: hidden;
      }
      .sm-sidebar {
        width: 220px;
        min-width: 180px;
        border-right: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        background: var(--color-background-alt, #1e2b3c);
      }
      .sm-org-list {
        padding: 8px;
        border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
      }
      .sm-org-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .sm-org-item:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .sm-org-item.active {
        background: rgba(91, 158, 248, 0.1);
        border: 1px solid rgba(91, 158, 248, 0.3);
      }
      .sm-org-icon {
        width: 28px;
        height: 28px;
        border-radius: 4px;
        background: var(--color-primary, #175ddc);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .sm-org-info {
        flex: 1;
        min-width: 0;
      }
      .sm-org-label {
        font-size: 13px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sm-org-stats {
        font-size: 10px;
        color: var(--color-text-muted, #7a92b0);
      }
      .sm-org-empty {
        padding: 8px;
        font-size: 12px;
        color: var(--color-text-muted, #7a92b0);
        text-align: center;
      }
      .sm-nav {
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sm-nav-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--color-text-muted, #7a92b0);
        font-size: 13px;
        cursor: pointer;
        text-align: left;
        width: 100%;
        transition: background 0.12s;
      }
      .sm-nav-item:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--color-text, #dce8f8);
      }
      .sm-nav-item.active {
        background: rgba(91, 158, 248, 0.1);
        color: var(--color-primary, #5b9ef8);
      }
      .sm-nav-separator {
        height: 1px;
        background: var(--color-border, rgba(255, 255, 255, 0.07));
        margin: 4px 0;
      }
      .sm-badge {
        margin-left: auto;
        padding: 1px 6px;
        border-radius: 10px;
        background: rgba(91, 158, 248, 0.14);
        color: #5b9ef8;
        font-size: 10px;
        font-weight: 600;
      }
      .sm-main {
        flex: 1;
        padding: 24px;
        overflow-y: auto;
      }
      .sm-section h2 {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
      }
      .sm-stats {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
      }
      .sm-stat {
        flex: 1;
        padding: 16px;
        border-radius: 6px;
        background: var(--color-background-alt, #1e2b3c);
        border: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
        text-align: center;
      }
      .sm-stat-value {
        font-size: 28px;
        font-weight: 700;
      }
      .sm-stat-label {
        font-size: 12px;
        color: var(--color-text-muted, #7a92b0);
        margin-top: 4px;
      }
      .sm-org-detail {
        margin-top: 16px;
      }
      .sm-org-detail label {
        display: block;
        font-size: 12px;
        color: var(--color-text-muted, #7a92b0);
        margin-bottom: 4px;
      }
      .sm-org-detail code {
        font-size: 12px;
        word-break: break-all;
        padding: 4px 8px;
        background: var(--color-background-alt, #1e2b3c);
        border-radius: 4px;
        display: block;
      }
      .sm-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .sm-table th {
        text-align: left;
        padding: 8px 12px;
        font-size: 11px;
        font-weight: 600;
        color: var(--color-text-muted, #7a92b0);
        border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
      }
      .sm-table td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
      }
      .sm-table code {
        font-size: 12px;
      }
      .sm-empty,
      .sm-info {
        padding: 16px 0;
        color: var(--color-text-muted, #7a92b0);
        font-size: 13px;
      }
      .sm-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 14px;
        border: 1px solid transparent;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
        font-family: inherit;
      }
      .sm-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .sm-btn-primary {
        background: var(--color-primary, #175ddc);
        color: #fff;
      }
      .sm-btn-primary:hover:not(:disabled) {
        background: #1a6aef;
      }
      .sm-btn-ghost {
        background: transparent;
        color: var(--color-text, #dce8f8);
        border-color: var(--color-border, rgba(255, 255, 255, 0.12));
      }
      .sm-btn-ghost:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.05);
      }
      .sm-btn-danger {
        background: transparent;
        color: var(--color-danger, #ff5454);
        border-color: transparent;
      }
      .sm-btn-danger:hover:not(:disabled) {
        background: rgba(255, 84, 84, 0.1);
      }
      .sm-btn-xs {
        padding: 3px 8px;
        font-size: 11px;
      }
      .sm-field {
        margin-bottom: 16px;
      }
      .sm-field label {
        display: block;
        font-size: 12px;
        color: var(--color-text-muted, #7a92b0);
        margin-bottom: 4px;
      }
      .sm-input {
        width: 100%;
        max-width: 400px;
        padding: 8px 12px;
        background: var(--color-background-alt, #1e2b3c);
        border: 1px solid var(--color-border, rgba(255, 255, 255, 0.12));
        border-radius: 4px;
        color: var(--color-text, #dce8f8);
        font-size: 14px;
        font-family: inherit;
      }
      .sm-input:focus {
        outline: none;
        border-color: var(--color-primary, #5b9ef8);
      }
      .sm-error-text {
        margin-top: 8px;
        color: var(--color-danger, #ff5454);
        font-size: 13px;
      }
      .sm-modal {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
      }
      .sm-modal-content {
        background: var(--color-background-alt, #1e2b3c);
        padding: 24px;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        border: 1px solid var(--color-border, rgba(255, 255, 255, 0.12));
      }
      .sm-modal-content h3 {
        margin-bottom: 8px;
      }
      .sm-token-meta {
        font-size: 12px;
        color: var(--color-text-muted, #7a92b0);
        margin-bottom: 12px;
      }
      .sm-token-value {
        display: block;
        padding: 10px;
        margin-bottom: 16px;
        background: var(--color-background, #1a2332);
        border-radius: 4px;
        font-size: 12px;
        word-break: break-all;
        font-family: monospace;
        max-height: 80px;
        overflow-y: auto;
      }
      .sm-modal-actions {
        display: flex;
        gap: 8px;
      }
      .sm-badge-rw {
        background: rgba(26, 195, 125, 0.15);
        color: #1ac37d;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }
      .sm-badge-ro {
        background: rgba(122, 146, 176, 0.18);
        color: #7a92b0;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }
      .sm-nav-item:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .sm-empty-state {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
        max-width: 600px;
      }
      .sm-empty-state h2 {
        font-size: 22px;
        font-weight: 600;
      }
      .sm-empty-state .sm-info {
        font-size: 14px;
        line-height: 1.5;
      }
    `,
  ],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmAdminComponent implements OnInit, OnDestroy {
  organizations: OrganizationState[] = [];
  selectedOrg: OrganizationState | null = null;
  activeSection: Section = "overview";
  loading = true;
  error: string | null = null;
  secrets: SecretEntry[] = [];

  provForm: ProvisionRequest = { orgName: "", project: "", readOnly: false };
  provSubmitting = false;
  provError: string | null = null;
  provResult: ProvisionResponse | null = null;

  constructor(
    private stateService: SmStateService,
    private api: SmAdminService,
    private accountService: AccountService,
    private tokenService: TokenService,
    private changeDetectorRef: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    console.log("[sm-admin] ngOnInit start");

    const sessionEstablished = await this.ensureAdminSession();
    if (!sessionEstablished) {
      this.error = "Not authenticated. Please log into the vault first.";
      this.loading = false;
      console.log("[sm-admin] set not-authenticated error");
      this.changeDetectorRef.markForCheck();
      return;
    }

    try {
      console.log("[sm-admin] calling fetchState");
      const state = await Promise.race([
        this.api.fetchState(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("fetchState timeout")), 10000),
        ),
      ]);
      console.log("[sm-admin] fetchState returned", state);
      this.stateService.setState(state);
      this.refreshFromState();
    } catch (e: any) {
      console.error("[sm-admin] fetchState failed:", e);
      this.error = e?.message || "Failed to load Secrets Manager state.";
    } finally {
      this.loading = false;
      this.changeDetectorRef.markForCheck();
      console.log("[sm-admin] ngOnInit done, loading=false");
    }
  }

  ngOnDestroy(): void {
    void this.api.clearAdminSession().catch((err) => {
      console.warn("[sm-admin] failed to clear admin session:", err);
    });
  }

  private async ensureAdminSession(): Promise<boolean> {
    console.log("[sm-admin] establishing HttpOnly admin session from TokenService");
    try {
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(
          take(1),
          timeout({ each: 5000 }),
          getOptionalUserId,
        ),
      );
      console.log("[sm-admin] activeAccount$ userId:", userId);
      if (!userId) {
        console.warn("[sm-admin] no active account");
        return false;
      }
      const accessToken = await this.tokenService.getAccessToken(userId);
      console.log(
        "[sm-admin] TokenService returned access token:",
        accessToken ? "present" : "null",
      );
      if (!accessToken) {
        return false;
      }
      await this.api.establishAdminSession(accessToken);
      return true;
    } catch (err) {
      console.error("[sm-admin] ensureAdminSession failed:", err);
      return false;
    }
  }

  private refreshFromState(): void {
    this.organizations = this.stateService.organizations;
    this.selectedOrg = this.stateService.selectedOrg;
    if (this.selectedOrg) {
      void this.loadSecrets();
    }
    this.changeDetectorRef.markForCheck();
  }

  private async loadSecrets(): Promise<void> {
    if (!this.selectedOrg) {
      return;
    }
    try {
      const data = await this.api.listSecrets(this.selectedOrg.id);
      this.secrets = data.secrets ?? [];
    } catch {
      this.secrets = [];
    }
    this.changeDetectorRef.markForCheck();
  }

  selectOrg(orgId: string): void {
    this.stateService.selectOrg(orgId);
    this.refreshFromState();
    this.activeSection = "overview";
    this.changeDetectorRef.markForCheck();
  }

  switchSection(section: Section): void {
    this.activeSection = section;
    if (section === "secrets" && this.selectedOrg) {
      void this.loadSecrets();
    }
    this.changeDetectorRef.markForCheck();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.changeDetectorRef.markForCheck();
    try {
      const state = await this.api.fetchState();
      this.stateService.setState(state);
      this.refreshFromState();
    } catch (e: any) {
      this.error = e?.message || "Refresh failed.";
    }
    this.loading = false;
    this.changeDetectorRef.markForCheck();
  }

  async provision(e: Event): Promise<void> {
    e.preventDefault();
    this.provError = null;
    if (!this.provForm.orgName.trim() || !this.provForm.project.trim()) {
      this.provError = "Organization name and project name are required.";
      this.changeDetectorRef.markForCheck();
      return;
    }
    this.provSubmitting = true;
    this.changeDetectorRef.markForCheck();
    try {
      this.provResult = await this.api.provision(this.provForm);
      this.provForm = { orgName: "", project: "", readOnly: false };
      await this.refresh();
    } catch (err: any) {
      this.provError = err?.message || "Provision failed.";
    } finally {
      this.provSubmitting = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  async deleteProject(orgId: string, projectId: string): Promise<void> {
    if (!confirm("Delete this project and all its secrets?")) {
      return;
    }
    try {
      await this.api.deleteProject(orgId, projectId);
    } catch (err: any) {
      alert("Delete failed: " + (err?.message || "Unknown error"));
    }
    void this.refresh();
  }

  async revokeToken(orgId: string, clientId: string): Promise<void> {
    if (!confirm("Revoke this machine account? This permanently invalidates its access token.")) {
      return;
    }
    try {
      await this.api.revokeToken(orgId, clientId);
    } catch (err: any) {
      alert("Revoke failed: " + (err?.message || "Unknown error"));
    }
    void this.refresh();
  }

  copyToken(): void {
    if (!this.provResult) {
      return;
    }
    void navigator.clipboard?.writeText(this.provResult.accessToken);
  }
}
