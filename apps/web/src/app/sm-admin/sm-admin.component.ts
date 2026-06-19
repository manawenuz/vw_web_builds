import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import {
  AdminState,
  OrganizationState,
  ProjectState,
  SecretEntry,
  SecretWriteRequest,
} from "./models/sm-admin.models";
import { SmAdminService } from "./services/sm-admin.service";

type DecryptedProject = ProjectState & { label: string };
type DecryptedSecret = SecretEntry & {
  label: string;
  secretValue: string;
  noteText: string;
  projectLabel: string;
};
type ActiveSection =
  | "overview"
  | "projects"
  | "secrets"
  | "machine-accounts"
  | "integrations"
  | "trash"
  | "settings"
  | "import"
  | "export";
type ModalMode = "secret" | "provision" | "token" | "delete-org" | null;

@Component({
  selector: "app-sm-admin",
  standalone: false,
  templateUrl: "./sm-admin.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        min-height: 100%;
        overflow: auto;
        --sm-bg: #ffffff;
        --sm-surface: #ffffff;
        --sm-surface-hover: #f3f6f9;
        --sm-sidebar: #212529;
        --sm-sidebar-active: rgba(255, 255, 255, 0.16);
        --sm-sidebar-hover: rgba(0, 0, 0, 0.22);
        --sm-sidebar-border: rgba(255, 255, 255, 0.16);
        --sm-text: #1b2029;
        --sm-muted: #606d91;
        --sm-subtle: #62748e;
        --sm-border: #d5dde8;
        --sm-border-strong: #b4c2d4;
        --sm-primary: #175ddc;
        --sm-primary-hover: #1252a3;
        --sm-primary-soft: #dbeafe;
        --sm-danger: #cb263a;
        --sm-success: #0c8018;
        --sm-shadow: 0 16px 44px rgba(27, 32, 41, 0.18);
        background: var(--sm-bg);
        color: var(--sm-text);
      }

      :host-context(.theme_dark),
      :host-context([data-theme="dark"]) {
        --sm-bg: #0f172a;
        --sm-surface: #111b30;
        --sm-surface-hover: #18243a;
        --sm-sidebar: #1f293b;
        --sm-sidebar-active: #52617a;
        --sm-sidebar-hover: #26344a;
        --sm-sidebar-border: rgba(255, 255, 255, 0.11);
        --sm-text: #f3f6fb;
        --sm-muted: #c4cedd;
        --sm-subtle: #8fa0b7;
        --sm-border: rgba(255, 255, 255, 0.12);
        --sm-border-strong: rgba(255, 255, 255, 0.28);
        --sm-primary-soft: rgba(91, 158, 248, 0.14);
        --sm-danger: #ff5454;
        --sm-success: #1ac37d;
        --sm-shadow: 0 18px 52px rgba(0, 0, 0, 0.58);
      }

      * {
        box-sizing: border-box;
      }

      button,
      input,
      textarea,
      select {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      .sm-shell {
        min-height: 100vh;
        background: var(--sm-bg);
        color: var(--sm-text);
      }

      .topbar {
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        background: color-mix(in srgb, var(--sm-sidebar) 92%, transparent);
        border-bottom: 1px solid var(--sm-sidebar-border);
      }

      .topbar-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #ffffff;
        font-size: 15px;
      }

      .topbar-brand span:last-child {
        color: #c4cedd;
        border-left: 1px solid rgba(255, 255, 255, 0.35);
        padding-left: 10px;
        font-weight: 400;
      }

      .shield {
        width: 26px;
        height: 26px;
        border: 2px solid currentColor;
        border-radius: 46% 46% 54% 54%;
        display: inline-block;
        position: relative;
        color: #5b9ef8;
        flex: 0 0 auto;
      }

      .shield::after {
        content: "";
        position: absolute;
        inset: 5px 7px 6px;
        border-left: 2px solid currentColor;
        border-bottom: 2px solid currentColor;
        transform: skewX(-14deg) rotate(-18deg);
      }

      .shield-large {
        width: 34px;
        height: 34px;
        color: #ffffff;
      }

      .product-layout {
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr);
        min-height: calc(100vh - 56px);
      }

      .sm-sidebar {
        background: var(--sm-sidebar);
        color: #ffffff;
        border-right: 1px solid var(--sm-sidebar-border);
        display: grid;
        grid-template-rows: auto auto auto auto 1fr auto;
        min-height: calc(100vh - 56px);
      }

      .brand {
        padding: 24px 20px 26px;
        border-bottom: 1px solid var(--sm-sidebar-border);
      }

      .brand-main {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 30px;
        font-weight: 700;
        letter-spacing: 0;
      }

      .brand-subtitle {
        color: #d5dde8;
        font-size: 13px;
        margin-left: 44px;
        margin-top: -4px;
      }

      .org-group {
        padding: 18px 12px 8px;
      }

      .org-heading {
        width: 100%;
        min-height: 32px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 8px 10px;
        font-weight: 700;
        text-align: left;
      }

      .org-heading:hover {
        background: var(--sm-sidebar-hover);
      }

      .org-heading:not(.active) {
        opacity: 0.72;
      }

      .chevron {
        color: #c4cedd;
        font-size: 12px;
      }

      .org-heading-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .org-nav {
        display: grid;
        gap: 4px;
        margin-top: 8px;
      }

      .nav-item {
        width: 100%;
        min-height: 38px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: #f3f6fb;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        font-weight: 600;
        text-align: left;
      }

      .nav-item:hover {
        background: var(--sm-sidebar-hover);
      }

      .nav-item.active {
        background: var(--sm-sidebar-active);
        color: #ffffff;
      }

      .org-summary {
        min-height: 58px;
        margin-bottom: 8px;
      }

      .org-avatar {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background: var(--sm-primary);
        color: #ffffff;
        display: grid;
        place-items: center;
        font-size: 13px;
        font-weight: 700;
        flex: 0 0 auto;
      }

      .org-summary-copy {
        display: grid;
        gap: 1px;
        min-width: 0;
      }

      .org-summary-copy strong,
      .org-summary-copy small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .org-summary-copy small {
        color: #d5dde8;
        font-size: 12px;
        font-weight: 500;
      }

      .nav-icon {
        width: 22px;
        color: #c4cedd;
        text-align: center;
        flex: 0 0 auto;
      }

      .nav-count {
        margin-left: auto;
        color: #f3f6fb;
        font-size: 13px;
      }

      .nav-subitem {
        padding-left: 42px;
        color: #d5dde8;
      }

      .org-create {
        margin-top: 8px;
        color: #d5dde8;
      }

      .nav-separator {
        height: 1px;
        background: var(--sm-sidebar-border);
        margin: 10px 12px;
      }

      .sidebar-bottom {
        border-top: 1px solid var(--sm-sidebar-border);
        padding: 12px;
        display: grid;
        gap: 4px;
      }

      .mode-item {
        border-radius: 8px;
        color: #f3f6fb;
        display: flex;
        align-items: center;
        min-height: 38px;
        padding: 8px 12px;
        font-weight: 700;
        text-decoration: none;
      }

      .mode-item:hover,
      .mode-item.active {
        background: var(--sm-sidebar-active);
        color: #ffffff;
        text-decoration: none;
      }

      .main {
        min-width: 0;
        padding: 34px 40px 56px;
        position: relative;
      }

      .content-actions {
        position: sticky;
        top: 16px;
        z-index: 20;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        min-height: 42px;
        pointer-events: none;
      }

      .content-actions > * {
        pointer-events: auto;
      }

      .page-header {
        margin: -32px 0 30px;
        padding-right: 180px;
      }

      h1,
      h2 {
        color: var(--sm-text);
        margin: 0;
      }

      h1 {
        font-size: 24px;
        font-weight: 700;
        line-height: 1.2;
      }

      h2 {
        font-size: 17px;
        font-weight: 700;
      }

      .muted {
        color: var(--sm-muted);
      }

      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .btn {
        border: 1px solid var(--sm-border-strong);
        border-radius: 6px;
        padding: 9px 15px;
        background: var(--sm-surface);
        color: var(--sm-text);
        font-weight: 600;
        min-height: 40px;
      }

      .btn-primary {
        background: var(--sm-primary);
        border-color: var(--sm-primary);
        color: #ffffff;
      }

      .btn-primary:hover:not(:disabled) {
        background: var(--sm-primary-hover);
        border-color: var(--sm-primary-hover);
      }

      .btn-danger {
        background: var(--sm-danger);
        border-color: var(--sm-danger);
        color: #ffffff;
      }

      .btn-danger:hover:not(:disabled) {
        filter: brightness(0.92);
      }

      .btn-icon {
        width: 40px;
        padding: 0;
        font-size: 22px;
        line-height: 1;
      }

      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .section-stack {
        display: grid;
        gap: 28px;
      }

      .section-block {
        margin-bottom: 28px;
      }

      .section-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .section-toggle,
      .link-button,
      .row-options {
        border: 0;
        background: transparent;
        color: var(--sm-muted);
      }

      .link-button {
        margin-left: auto;
        color: #79b8ff;
        font-weight: 600;
        padding: 5px 0;
      }

      :host-context(.theme_light) .link-button,
      :host-context([data-theme="light"]) .link-button {
        color: var(--sm-primary-hover);
      }

      .data-table-wrap {
        overflow: auto;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      .data-table th,
      .data-table td {
        text-align: left;
        padding: 12px 14px;
        border-bottom: 1px solid var(--sm-border);
        vertical-align: middle;
      }

      .data-table th {
        color: var(--sm-muted);
        font-weight: 600;
        font-size: 13px;
      }

      .data-table tbody tr:hover {
        background: var(--sm-surface-hover);
      }

      .checkbox-cell {
        width: 40px;
      }

      .options-cell {
        width: 120px;
        text-align: right;
      }

      .item-link {
        color: #79b8ff;
        font-weight: 700;
      }

      :host-context(.theme_light) .item-link,
      :host-context([data-theme="light"]) .item-link {
        color: var(--sm-primary-hover);
      }

      .folder-icon,
      .key-icon {
        width: 16px;
        height: 16px;
        display: inline-block;
        margin-right: 10px;
        vertical-align: -2px;
        position: relative;
        color: var(--sm-muted);
      }

      .folder-icon {
        border: 1.8px solid currentColor;
        border-radius: 3px;
      }

      .folder-icon::before {
        content: "";
        position: absolute;
        left: 1px;
        top: -5px;
        width: 8px;
        height: 5px;
        border: 1.8px solid currentColor;
        border-bottom: 0;
        border-radius: 3px 3px 0 0;
      }

      .key-icon::before {
        content: "";
        position: absolute;
        left: 0;
        top: 5px;
        width: 7px;
        height: 7px;
        border: 2px solid currentColor;
        border-radius: 50%;
      }

      .key-icon::after {
        content: "";
        position: absolute;
        left: 8px;
        top: 8px;
        width: 8px;
        height: 2px;
        background: currentColor;
        box-shadow: 5px 0 0 currentColor;
      }

      .empty-cell {
        text-align: center;
        color: var(--sm-subtle);
        padding: 28px 14px;
      }

      .row-options {
        border-radius: 6px;
        font-weight: 700;
        letter-spacing: 1px;
        padding: 4px 8px;
      }

      .row-options:hover {
        background: var(--sm-surface-hover);
        color: var(--sm-text);
      }

      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 3px 10px;
        font-size: 12px;
        font-weight: 700;
      }

      .badge-rw {
        background: rgba(26, 195, 125, 0.15);
        color: var(--sm-success);
      }

      .badge-ro {
        background: var(--sm-primary-soft);
        color: var(--sm-muted);
      }

      .field {
        display: grid;
        gap: 7px;
      }

      .field > span {
        color: var(--sm-text);
        font-weight: 700;
        font-size: 13px;
      }

      .field small {
        color: var(--sm-muted);
        font-weight: 500;
      }

      input,
      textarea,
      select {
        width: 100%;
        border: 1px solid var(--sm-border-strong);
        border-radius: 6px;
        background: var(--sm-bg);
        color: var(--sm-text);
        padding: 10px 12px;
      }

      textarea {
        min-height: 92px;
        resize: vertical;
      }

      input:focus,
      textarea:focus,
      select:focus {
        border-color: var(--sm-primary);
        box-shadow: 0 0 0 3px rgba(23, 93, 220, 0.22);
        outline: 0;
      }

      .callout {
        border: 1px solid var(--sm-primary);
        background: var(--sm-primary-soft);
        border-radius: 8px;
        padding: 12px 14px;
        color: var(--sm-text);
        margin-bottom: 18px;
      }

      .token-box {
        word-break: break-all;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        background: var(--sm-bg);
        border: 1px solid var(--sm-border-strong);
        border-radius: 6px;
        padding: 12px;
        margin-top: 12px;
      }

      .empty-view {
        border: 1px solid var(--sm-border);
        border-radius: 8px;
        padding: 22px;
        max-width: 620px;
      }

      .settings-view {
        max-width: 720px;
        display: grid;
        gap: 24px;
      }

      .settings-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .danger-zone {
        border-top: 1px solid var(--sm-border);
        padding-top: 22px;
        display: grid;
        gap: 12px;
      }

      .danger-zone h3 {
        margin: 0;
        color: var(--sm-danger);
        font-size: 15px;
      }

      .danger-list {
        margin: 12px 0 0;
        color: var(--sm-muted);
      }

      .status {
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: var(--sm-bg);
        color: var(--sm-muted);
      }

      .error {
        color: var(--sm-danger);
        margin-bottom: 16px;
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1000;
        background: rgba(0, 0, 0, 0.68);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .modal-card {
        width: min(760px, 100%);
        max-height: min(860px, calc(100vh - 48px));
        overflow: auto;
        background: var(--sm-surface);
        border: 1px solid var(--sm-border-strong);
        border-radius: 10px;
        box-shadow: var(--sm-shadow);
        padding: 24px;
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 22px;
      }

      .modal-close {
        border: 0;
        background: transparent;
        color: var(--sm-muted);
        font-size: 30px;
        line-height: 1;
        width: 36px;
        height: 36px;
        border-radius: 6px;
      }

      .modal-close:hover {
        background: var(--sm-surface-hover);
        color: var(--sm-text);
      }

      .modal-body {
        display: grid;
        gap: 16px;
      }

      .modal-actions {
        display: flex;
        flex-direction: row-reverse;
        justify-content: flex-start;
        gap: 10px;
        margin-top: 24px;
      }

      @media (max-width: 900px) {
        .product-layout {
          grid-template-columns: 1fr;
        }

        .sm-sidebar {
          min-height: auto;
          display: block;
        }

        .sidebar-bottom {
          display: none;
        }

        .main {
          padding: 24px 18px 42px;
        }

        .content-actions {
          position: static;
          justify-content: flex-start;
          margin-bottom: 18px;
        }

        .page-header {
          margin: 0 0 22px;
          padding-right: 0;
        }
      }
    `,
  ],
})
export class SmAdminComponent implements OnInit, OnDestroy {
  protected readonly ready = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly state = signal<AdminState | null>(null);
  protected readonly selectedOrgId = signal<string | null>(null);
  protected readonly decryptedProjects = signal<DecryptedProject[]>([]);
  protected readonly decryptedSecrets = signal<DecryptedSecret[]>([]);
  protected readonly orgKeyStatus = signal<string | null>(null);
  protected readonly generatedAccessToken = signal<string | null>(null);
  protected readonly activeSection = signal<ActiveSection>("overview");
  protected readonly modalMode = signal<ModalMode>(null);

  protected readonly newSecret = {
    name: "",
    value: "",
    note: "",
    projectId: "",
  };

  protected readonly newOrg = {
    orgName: "",
    projectName: "",
    secretName: "",
    secretValue: "",
    secretNote: "",
  };

  protected readonly deleteOrg = {
    confirmation: "",
  };

  protected readonly organizations = computed(() => this.state()?.organizations ?? []);
  protected readonly selectedOrg = computed(() => {
    const orgId = this.selectedOrgId();
    return this.organizations().find((org) => org.id === orgId) ?? null;
  });

  private readonly userId: UserId | null = null;
  private readonly userKey: UserKey | null = null;
  private readonly bwsOrgKey: SymmetricCryptoKey | null = null;

  constructor(
    private readonly tokenService: TokenService,
    private readonly accountService: AccountService,
    private readonly keyService: KeyService,
    private readonly encryptService: EncryptService,
    private readonly smAdminService: SmAdminService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.loading.set(true);
      this.userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
      const jwt = await this.tokenService.getAccessToken(this.userId);
      if (!jwt) {
        throw new Error("No active vault session was found.");
      }
      this.userKey = await firstValueFrom(this.keyService.userKey$(this.userId));
      if (!this.userKey) {
        throw new Error("Unlock your vault before opening Secrets Manager.");
      }
      await this.smAdminService.establishAdminSession(jwt);
      await this.refreshState();
      this.ready.set(true);
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    void this.smAdminService.clearAdminSession().catch((): void => {});
  }

  protected async refreshState(): Promise<void> {
    const state = await this.smAdminService.fetchState();
    this.state.set(state);
    const current = this.selectedOrgId();
    const nextOrgId =
      current && state.organizations.some((org) => org.id === current)
        ? current
        : (state.organizations[0]?.id ?? null);
    this.selectedOrgId.set(nextOrgId);
    if (nextOrgId) {
      await this.loadSelectedOrg();
    } else {
      this.decryptedProjects.set([]);
      this.decryptedSecrets.set([]);
      this.bwsOrgKey = null;
      this.orgKeyStatus.set(null);
    }
  }

  protected async selectOrg(org: OrganizationState): Promise<void> {
    this.selectedOrgId.set(org.id);
    this.activeSection.set("overview");
    await this.loadSelectedOrg();
  }

  protected setSection(section: ActiveSection): void {
    this.activeSection.set(section);
  }

  protected visibleProjects(preview: boolean): DecryptedProject[] {
    const projects = this.decryptedProjects();
    return preview ? projects.slice(0, 4) : projects;
  }

  protected visibleSecrets(preview: boolean): DecryptedSecret[] {
    const secrets = this.decryptedSecrets();
    return preview ? secrets.slice(0, 6) : secrets;
  }

  protected openNewSecret(): void {
    if (!this.selectedOrg()) {
      this.openProvision();
      return;
    }
    if (this.orgKeyStatus()) {
      this.error.set(this.orgKeyStatus());
      return;
    }
    this.error.set(null);
    this.modalMode.set("secret");
  }

  protected openProvision(): void {
    this.error.set(null);
    this.modalMode.set("provision");
  }

  protected openDeleteOrganization(): void {
    if (!this.selectedOrg()) {
      return;
    }
    this.deleteOrg.confirmation = "";
    this.error.set(null);
    this.modalMode.set("delete-org");
  }

  protected closeModal(): void {
    this.modalMode.set(null);
  }

  protected async createSecureOrg(): Promise<void> {
    if (!this.userKey) {
      this.error.set("Unlock your vault before creating a secure Secrets Manager organization.");
      return;
    }
    if (!this.newOrg.orgName.trim() || !this.newOrg.projectName.trim()) {
      this.error.set("Organization name and project name are required.");
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.generatedAccessToken.set(null);

    try {
      const bwsKey = this.randomSymmetricKey();
      const encryptedOrgKey = await this.encryptService.wrapSymmetricKey(bwsKey, this.userKey);
      const encryptedProjectName = await this.encryptService.encryptString(
        this.newOrg.projectName.trim(),
        bwsKey,
      );
      const clientSecret = this.randomSecret();
      const seed = this.randomBytes(16);
      const tokenKey = await this.deriveTokenKey(seed);
      const encryptedPayload = await this.encryptService.encryptString(
        JSON.stringify({ encryptionKey: bwsKey.toBase64() }),
        tokenKey,
      );

      const secrets: SecretWriteRequest[] = [];
      if (this.newOrg.secretName.trim()) {
        secrets.push({
          key: this.encStringValue(
            await this.encryptService.encryptString(this.newOrg.secretName.trim(), bwsKey),
          ),
          value: this.encStringValue(
            await this.encryptService.encryptString(this.newOrg.secretValue, bwsKey),
          ),
          note: this.encStringValue(
            await this.encryptService.encryptString(this.newOrg.secretNote, bwsKey),
          ),
        });
      }

      const response = await this.smAdminService.provisionEncrypted({
        orgName: this.newOrg.orgName.trim(),
        encryptedOrgKey: this.encStringValue(encryptedOrgKey),
        project: {
          name: this.encStringValue(encryptedProjectName),
        },
        machineAccount: {
          clientSecret,
          encryptedPayload: this.encStringValue(encryptedPayload),
          write: true,
        },
        secrets,
      });

      this.generatedAccessToken.set(`0.${response.clientId}.${clientSecret}:${this.b64(seed)}`);
      this.newOrg.orgName = "";
      this.newOrg.projectName = "";
      this.newOrg.secretName = "";
      this.newOrg.secretValue = "";
      this.newOrg.secretNote = "";
      await this.refreshState();
      this.selectedOrgId.set(response.orgId);
      await this.loadSelectedOrg();
      this.modalMode.set("token");
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async createSecret(): Promise<void> {
    const org = this.selectedOrg();
    if (!org || !this.bwsOrgKey) {
      this.error.set("This organization does not have a decryptable BWS key envelope.");
      return;
    }
    if (!this.newSecret.name.trim()) {
      this.error.set("Secret name is required.");
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.smAdminService.createSecret(org.id, {
        key: this.encStringValue(
          await this.encryptService.encryptString(this.newSecret.name.trim(), this.bwsOrgKey),
        ),
        value: this.encStringValue(
          await this.encryptService.encryptString(this.newSecret.value, this.bwsOrgKey),
        ),
        note: this.encStringValue(
          await this.encryptService.encryptString(this.newSecret.note, this.bwsOrgKey),
        ),
        projectIds: this.newSecret.projectId ? [this.newSecret.projectId] : [],
      });
      this.newSecret.name = "";
      this.newSecret.value = "";
      this.newSecret.note = "";
      await this.refreshState();
      this.modalMode.set(null);
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected deleteOrgLabel(): string {
    const org = this.selectedOrg();
    return org ? this.orgLabel(org) : "";
  }

  protected deleteOrgConfirmationMatches(): boolean {
    const label = this.deleteOrgLabel();
    return label.length > 0 && this.deleteOrg.confirmation.trim() === label;
  }

  protected async deleteSelectedOrganization(): Promise<void> {
    const org = this.selectedOrg();
    if (!org) {
      return;
    }
    if (!this.deleteOrgConfirmationMatches()) {
      this.error.set("Type the organization name exactly to delete it.");
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.smAdminService.deleteOrganization(org.id);
      this.modalMode.set(null);
      this.deleteOrg.confirmation = "";
      this.activeSection.set("overview");
      await this.refreshState();
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async copyGeneratedToken(): Promise<void> {
    const token = this.generatedAccessToken();
    if (token) {
      await navigator.clipboard.writeText(token);
    }
  }

  protected projectOptions(): DecryptedProject[] {
    return this.decryptedProjects();
  }

  protected orgLabel(org: OrganizationState): string {
    return org.displayName || org.id.slice(0, 8);
  }

  protected orgInitials(org: OrganizationState): string {
    const label = this.orgLabel(org).trim();
    const words = label.split(/\s+/).filter(Boolean);
    const initials = words.length > 1 ? `${words[0][0]}${words[1][0]}` : label.slice(0, 2);
    return initials.toUpperCase();
  }

  private async loadSelectedOrg(): Promise<void> {
    const org = this.selectedOrg();
    this.decryptedProjects.set([]);
    this.decryptedSecrets.set([]);
    this.bwsOrgKey = null;
    this.orgKeyStatus.set(null);
    if (!org || !this.userKey) {
      return;
    }

    try {
      const envelope = await this.smAdminService.getOrgUserKey(org.id);
      if (!envelope.encryptedOrgKey) {
        this.orgKeyStatus.set(
          "This organization does not have a local user key envelope yet. Create a new secure organization to use browser-side secret editing.",
        );
        return;
      }

      this.bwsOrgKey = await this.encryptService.unwrapSymmetricKey(
        new EncString(envelope.encryptedOrgKey),
        this.userKey,
      );

      const projects = await Promise.all(
        (org.projects ?? []).map(async (project) => ({
          ...project,
          label: await this.decryptLabel(
            project.name,
            this.bwsOrgKey!,
            project.displayName || project.id,
          ),
        })),
      );
      this.decryptedProjects.set(projects);
      this.newSecret.projectId = projects[0]?.id ?? "";

      const secrets = (await this.smAdminService.listSecrets(org.id)).secrets;
      const decrypted = await Promise.all(
        secrets.map(async (secret) => {
          const project = projects.find((item) => item.id === secret.projectId);
          return {
            ...secret,
            label: await this.decryptLabel(secret.key, this.bwsOrgKey!, "Encrypted secret"),
            secretValue: await this.decryptLabel(secret.value, this.bwsOrgKey!, ""),
            noteText: await this.decryptLabel(secret.note, this.bwsOrgKey!, ""),
            projectLabel: project?.label ?? "Unassigned",
          };
        }),
      );
      this.decryptedSecrets.set(decrypted);
    } catch (error) {
      this.orgKeyStatus.set(this.messageFromError(error));
    }
  }

  private async decryptLabel(
    encryptedValue: string | undefined,
    key: SymmetricCryptoKey,
    fallback: string,
  ): Promise<string> {
    if (!encryptedValue) {
      return fallback;
    }
    try {
      return await this.encryptService.decryptString(new EncString(encryptedValue), key);
    } catch {
      return fallback;
    }
  }

  private async deriveTokenKey(seed: Uint8Array): Promise<SymmetricCryptoKey> {
    const encoder = new TextEncoder();
    const seedBuffer = new ArrayBuffer(seed.byteLength);
    new Uint8Array(seedBuffer).set(seed);
    const baseKey = await globalThis.crypto.subtle.importKey("raw", seedBuffer, "HKDF", false, [
      "deriveBits",
    ]);
    const bits = await globalThis.crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: encoder.encode("bitwarden-accesstoken"),
        info: encoder.encode("sm-access-token"),
      },
      baseKey,
      512,
    );
    return new SymmetricCryptoKey(new Uint8Array(bits));
  }

  private randomSymmetricKey(): SymmetricCryptoKey {
    return new SymmetricCryptoKey(this.randomBytes(64));
  }

  private randomSecret(): string {
    return this.b64(this.randomBytes(24)).replace(/[+/=]/g, "");
  }

  private randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  private b64(bytes: Uint8Array): string {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  private encStringValue(value: EncString): string {
    return String(value.encryptedString ?? "");
  }

  private messageFromError(error: unknown): string {
    return error instanceof Error ? error.message : "Secrets Manager request failed.";
  }
}
