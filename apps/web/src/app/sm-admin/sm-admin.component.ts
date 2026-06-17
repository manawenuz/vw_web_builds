import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AccountService } from '@bitwarden/common/auth/abstractions/account.service';
import { getUserId } from '@bitwarden/common/auth/services/account.service';
import { TokenService } from '@bitwarden/common/auth/abstractions/token.service';

@Component({
  selector: 'app-sm-admin',
  templateUrl: './sm-admin.component.html',
  styleUrls: ['./sm-admin.component.scss'],
})
export class SmAdminComponent implements OnInit, OnDestroy {
  private injectedStyles: HTMLStyleElement[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private ngZone: NgZone,
    private tokenService: TokenService,
    private accountService: AccountService,
  ) {}

  async ngOnInit(): Promise<void> {
    // Get the vault's access token — this is the same JWT used for all vault API calls
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const jwt: string | null = await this.tokenService.getAccessToken(userId);

    if (!jwt) {
      console.error('[sm-admin] No access token available for the active user.');
      return;
    }

    // Expose globals for admin_ui.js embedded mode
    (window as any).__BWS_EMBEDDED__ = true;
    (window as any).__BWS_VAULT_JWT__ = jwt;
    (window as any).__BWS_ANGULAR_ROUTER__ = this.router;

    // Fetch the embedded-mode HTML from Vaultwarden
    let html: string;
    try {
      html = await firstValueFrom(
        this.http.get('/_admin/ui-embedded', { responseType: 'text' }),
      );
    } catch (e) {
      console.error('[sm-admin] Failed to load /_admin/ui-embedded', e);
      return;
    }

    // Parse HTML, inject body content and styles into our container
    this.ngZone.runOutsideAngular(() => {
      this.injectAdminUI(html);
    });
  }

  ngOnDestroy(): void {
    // Clean up injected styles
    this.injectedStyles.forEach((el) => el.remove());
    this.injectedStyles = [];

    // Clean up globals (prevent leaks across navigation)
    delete (window as any).__BWS_EMBEDDED__;
    delete (window as any).__BWS_VAULT_JWT__;
    delete (window as any).__BWS_ANGULAR_ROUTER__;
  }

  private injectAdminUI(html: string): void {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Inject <style> blocks (scoped to sm-admin-container via CSS)
    doc.querySelectorAll('style').forEach((style) => {
      const el = document.createElement('style');
      el.textContent = style.textContent;
      document.head.appendChild(el);
      this.injectedStyles.push(el);
    });

    // Inject body content into our container div
    const container = document.getElementById('sm-admin-container');
    if (container) {
      container.innerHTML = doc.body.innerHTML;
    }

    // Execute <script> blocks (admin_ui.js will self-invoke)
    doc.querySelectorAll('script').forEach((script) => {
      if (script.src) {
        // External script — create a <script> tag so the browser fetches it
        const el = document.createElement('script');
        el.src = script.src;
        el.defer = true;
        document.body.appendChild(el);
      } else if (script.textContent) {
        // Inline script — evaluate it
        // eslint-disable-next-line no-new-func
        const fn = new Function(script.textContent);
        fn();
      }
    });
  }
}
