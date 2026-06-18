import { HttpClient } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

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
      }

      .sm-admin-container {
        height: 100%;
        min-height: 0;
      }

      .sm-admin-frame {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
        background: transparent;
      }

      .sm-admin-status {
        padding: 2rem;
        color: var(--color-text-muted, #7a92b0);
        text-align: center;
      }

      .sm-admin-error {
        color: var(--color-danger, #c93a4f);
      }
    `,
  ],
})
export class SmAdminComponent implements OnInit, OnDestroy {
  protected readonly ready = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor(
    private readonly http: HttpClient,
    private readonly tokenService: TokenService,
    private readonly accountService: AccountService,
  ) {}

  async ngOnInit(): Promise<void> {
    // Get the vault's access token, which is the same JWT used for vault API calls.
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const jwt: string | null = await this.tokenService.getAccessToken(userId);

    if (!jwt) {
      this.error.set("No active vault session was found.");
      return;
    }

    try {
      await firstValueFrom(
        this.http.post("/_admin/session", { accessToken: jwt }, { responseType: "text" }),
      );
      this.ready.set(true);
    } catch {
      this.error.set("Could not establish a Secrets Manager admin session.");
    }
  }

  ngOnDestroy(): void {
    void firstValueFrom(this.http.delete("/_admin/session", { responseType: "text" })).catch(
      (): void => {},
    );
  }
}
