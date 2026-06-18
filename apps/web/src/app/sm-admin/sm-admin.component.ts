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

@Component({
  selector: "app-sm-admin",
  standalone: false,
  templateUrl: "./sm-admin.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        overflow: auto;
        background: var(--color-background-alt, #f7f8fa);
      }

      .sm-shell {
        min-height: 100%;
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
        color: var(--color-text-main, #1f2937);
      }

      .sm-sidebar {
        border-right: 1px solid var(--color-border, #d9e1ec);
        background: var(--color-background, #fff);
        padding: 24px 18px;
      }

      .brand {
        margin-bottom: 24px;
      }

      .brand-title {
        font-size: 24px;
        font-weight: 700;
      }

      .brand-subtitle {
        color: var(--color-text-muted, #52637a);
        font-size: 13px;
      }

      .org-button {
        width: 100%;
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 10px 12px;
        background: transparent;
        color: inherit;
        text-align: left;
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .org-button.active {
        background: var(--color-primary-100, #eaf2ff);
        border-color: var(--color-primary-500, #175ddc);
      }

      .org-avatar {
        width: 34px;
        height: 34px;
        border-radius: 6px;
        background: var(--color-primary-600, #175ddc);
        color: #fff;
        display: grid;
        place-items: center;
        font-weight: 700;
      }

      .main {
        padding: 28px 36px 48px;
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 24px;
      }

      h1,
      h2,
      h3 {
        margin: 0;
      }

      h1 {
        font-size: 28px;
      }

      h2 {
        font-size: 20px;
        margin-bottom: 12px;
      }

      h3 {
        font-size: 16px;
        margin-bottom: 10px;
      }

      .muted {
        color: var(--color-text-muted, #52637a);
      }

      .button-row {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }

      .btn {
        border: 1px solid var(--color-border, #d9e1ec);
        border-radius: 6px;
        padding: 9px 14px;
        background: var(--color-background, #fff);
        color: var(--color-text-main, #1f2937);
        font-weight: 600;
      }

      .btn-primary {
        background: var(--color-primary-600, #175ddc);
        border-color: var(--color-primary-600, #175ddc);
        color: #fff;
      }

      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
        gap: 24px;
        align-items: start;
      }

      .panel {
        border: 1px solid var(--color-border, #d9e1ec);
        background: var(--color-background, #fff);
        border-radius: 8px;
        padding: 18px;
      }

      .stack {
        display: grid;
        gap: 14px;
      }

      .field {
        display: grid;
        gap: 6px;
      }

      .field label {
        font-weight: 600;
        font-size: 13px;
      }

      input,
      textarea,
      select {
        width: 100%;
        border: 1px solid var(--color-border, #b8c3d4);
        border-radius: 6px;
        background: var(--color-background, #fff);
        color: var(--color-text-main, #1f2937);
        padding: 9px 10px;
      }

      textarea {
        min-height: 86px;
        resize: vertical;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        text-align: left;
        padding: 11px 8px;
        border-bottom: 1px solid var(--color-border, #d9e1ec);
        vertical-align: top;
      }

      th {
        color: var(--color-text-muted, #52637a);
        font-size: 13px;
      }

      .secret-value {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        white-space: pre-wrap;
      }

      .callout {
        border: 1px solid var(--color-primary-500, #175ddc);
        background: var(--color-primary-100, #eaf2ff);
        border-radius: 8px;
        padding: 13px 14px;
        color: var(--color-text-main, #1f2937);
      }

      .token-box {
        word-break: break-all;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        background: var(--color-background-alt, #f7f8fa);
        border: 1px solid var(--color-border, #d9e1ec);
        border-radius: 6px;
        padding: 10px;
      }

      .status {
        padding: 32px;
      }

      .error {
        color: var(--color-danger, #c93a4f);
      }

      @media (max-width: 900px) {
        .sm-shell,
        .grid {
          grid-template-columns: 1fr;
        }

        .sm-sidebar {
          border-right: 0;
          border-bottom: 1px solid var(--color-border, #d9e1ec);
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

  protected readonly organizations = computed(() => this.state()?.organizations ?? []);
  protected readonly selectedOrg = computed(() => {
    const orgId = this.selectedOrgId();
    return this.organizations().find((org) => org.id === orgId) ?? null;
  });

  private userId: UserId | null = null;
  private userKey: UserKey | null = null;
  private bwsOrgKey: SymmetricCryptoKey | null = null;

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
    }
  }

  protected async selectOrg(org: OrganizationState): Promise<void> {
    this.selectedOrgId.set(org.id);
    await this.loadSelectedOrg();
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
