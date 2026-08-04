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
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import {
  AccessTokenListItem,
  AdminState,
  AuditEvent,
  MachineAccount,
  MachineAccountProjectGrantListItem,
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
type ModalMode =
  | "secret"
  | "edit-secret"
  | "delete-secret"
  | "delete-secrets-bulk"
  | "delete-project"
  | "view-project"
  | "edit-project"
  | "provision"
  | "token"
  | "delete-org"
  | "new-project"
  | "new-machine-account"
  | "ma-detail"
  | "ma-create-token"
  | "ma-delete-token"
  | "delete-machine"
  | "delete-machines-bulk"
  | "relink-org"
  | null;

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

      .options-cell {
        position: relative;
      }

      .row-menu {
        /* position:fixed + inline top/right (from the trigger's rect) so the dropdown
           escapes the .data-table-wrap and :host overflow:auto clipping that hid it for
           the last/only row. No transformed ancestor exists, so fixed anchors to the
           viewport. */
        position: fixed;
        z-index: 30;
        display: flex;
        flex-direction: column;
        min-width: 132px;
        background: var(--sm-surface, #0f1f3d);
        border: 1px solid var(--sm-border, #2b3b5e);
        border-radius: 8px;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
        overflow: hidden;
      }

      .row-menu button {
        background: transparent;
        border: 0;
        color: var(--sm-text, #e8eefc);
        text-align: left;
        padding: 9px 14px;
        cursor: pointer;
        font: inherit;
      }

      .row-menu button:hover {
        background: var(--sm-surface-hover);
      }

      .row-menu button.danger {
        color: #ff8a8a;
      }

      .row-menu-overlay {
        position: fixed;
        inset: 0;
        z-index: 20;
        background: transparent;
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

      /* width:100% must NOT hit checkboxes/radios — it stretches them to fill flex rows and
         shoves their labels to the right (broke the project/secret grant lists). */
      input:not([type="checkbox"]):not([type="radio"]),
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

      /* Wrapper so the fixed-positioned dropdown does not shift the flex row */
      .new-menu-wrap {
        position: relative;
        display: flex;
      }

      /* Small caret inside the + New button */
      .new-menu-caret {
        font-size: 11px;
        margin-left: 5px;
        vertical-align: 1px;
      }

      .bulk-action-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
        padding: 8px 12px;
        background: var(--sm-primary-soft);
        border: 1px solid var(--sm-border);
        border-radius: 6px;
      }

      .bulk-count {
        font-weight: 600;
        color: var(--sm-text);
        font-size: 14px;
      }

      .bulk-delete-btn {
        margin-left: auto;
        font-size: 13px;
        min-height: 34px;
        padding: 5px 12px;
      }

      .row-selected td {
        background: var(--sm-primary-soft);
      }

      .data-table tbody .row-selected:hover td {
        background: color-mix(in srgb, var(--sm-primary-soft) 80%, var(--sm-surface-hover) 20%);
      }

      /* View-project modal: secrets list */
      .view-project-secrets {
        border: 1px solid var(--sm-border);
        border-radius: 6px;
        overflow: hidden;
      }

      .view-secret-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
        border-bottom: 1px solid var(--sm-border);
      }

      .view-secret-row:last-child {
        border-bottom: 0;
      }

      .view-secret-id {
        margin-left: auto;
        font-size: 12px;
        color: var(--sm-subtle);
      }

      .machine-project-row {
        display: flex;
        gap: 12px;
        align-items: baseline;
        padding: 6px 0;
        border-bottom: 1px solid var(--sm-border);
        font-size: 13px;
      }

      .machine-project-row:last-child {
        border-bottom: 0;
      }

      .machine-project-name {
        font-weight: 600;
        color: var(--sm-text);
      }

      .machine-bulk-list {
        margin-top: 10px;
        display: grid;
        gap: 4px;
        font-size: 13px;
      }

      /* MA detail tabbed pane (lives at modal-backdrop level, larger) */
      .ma-detail-card {
        width: min(900px, 100%);
        max-height: min(92vh, calc(100vh - 32px));
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: var(--sm-surface);
        border: 1px solid var(--sm-border-strong);
        border-radius: 10px;
        box-shadow: var(--sm-shadow);
      }

      .ma-detail-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 20px 24px 0;
        flex: 0 0 auto;
      }

      .ma-tabs {
        display: flex;
        gap: 0;
        border-bottom: 1px solid var(--sm-border);
        padding: 0 24px;
        margin-top: 16px;
        flex: 0 0 auto;
      }

      .ma-tab {
        border: 0;
        background: transparent;
        color: var(--sm-muted);
        font-weight: 600;
        font-size: 14px;
        padding: 10px 16px;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
      }

      .ma-tab.active {
        color: var(--sm-primary);
        border-bottom-color: var(--sm-primary);
      }

      .ma-tab:hover:not(.active) {
        color: var(--sm-text);
      }

      .ma-tab-body {
        overflow: auto;
        flex: 1 1 auto;
        padding: 20px 24px 24px;
      }

      /* Grant row: checkbox + name + write toggle */
      .grant-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid var(--sm-border);
        font-size: 14px;
      }

      .grant-row:last-child {
        border-bottom: 0;
      }

      .grant-name {
        flex: 1 1 auto;
        font-weight: 600;
      }

      .grant-write-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--sm-muted);
      }

      /* Audit event list */
      .audit-row {
        display: flex;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid var(--sm-border);
        font-size: 13px;
      }

      .audit-row:last-child {
        border-bottom: 0;
      }

      .audit-ts {
        flex: 0 0 160px;
        color: var(--sm-muted);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .audit-action {
        flex: 0 0 120px;
        font-weight: 600;
      }

      .audit-resource {
        flex: 1 1 auto;
        color: var(--sm-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Token list in MA detail */
      .token-list-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 9px 0;
        border-bottom: 1px solid var(--sm-border);
        font-size: 14px;
      }

      .token-list-row:last-child {
        border-bottom: 0;
      }

      .token-name {
        flex: 1 1 auto;
        font-weight: 600;
      }

      .token-meta {
        color: var(--sm-muted);
        font-size: 13px;
        flex: 0 0 auto;
      }

      .token-revoke-btn {
        flex: 0 0 auto;
        border: 0;
        background: transparent;
        color: var(--sm-danger);
        font-size: 13px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
      }

      .token-revoke-btn:hover {
        background: var(--sm-surface-hover);
      }

      /* People tab read-only chip */
      .people-owner-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid var(--sm-border);
      }

      .people-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--sm-primary);
        color: #ffffff;
        display: grid;
        place-items: center;
        font-size: 13px;
        font-weight: 700;
        flex: 0 0 auto;
      }

      .people-name {
        flex: 1 1 auto;
        font-weight: 600;
      }

      .people-role {
        font-size: 13px;
        color: var(--sm-muted);
      }

      /* Config tab copy rows */
      .config-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid var(--sm-border);
      }

      .config-row:last-child {
        border-bottom: 0;
      }

      .config-label {
        flex: 0 0 180px;
        font-weight: 600;
        font-size: 13px;
        color: var(--sm-muted);
      }

      .config-value {
        flex: 1 1 auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .config-copy-btn {
        flex: 0 0 auto;
        border: 0;
        background: transparent;
        color: var(--sm-muted);
        font-size: 13px;
        padding: 4px 8px;
        border-radius: 4px;
      }

      .config-copy-btn:hover {
        background: var(--sm-surface-hover);
        color: var(--sm-text);
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
  // True when the org-key envelope can't be unwrapped (typically after a master-key rotation):
  // surfaces a "Re-link organization" recovery CTA instead of a dead error.
  protected readonly orgKeyNeedsRelink = signal<boolean>(false);
  protected readonly relink = { token: "" };
  protected readonly generatedAccessToken = signal<string | null>(null);
  protected readonly activeSection = signal<ActiveSection>("overview");
  protected readonly modalMode = signal<ModalMode>(null);
  protected readonly rowMenu = signal<{
    kind: "secret" | "project" | "machine";
    id: string;
  } | null>(null);
  // Viewport coords for the fixed-position row menu, captured from the trigger button so
  // the dropdown escapes the .data-table-wrap / :host overflow:auto clipping that hid it
  // for the last/only row (see toggleRowMenu).
  protected readonly rowMenuPos = signal<{ top: number; right: number } | null>(null);

  // Tracks whether the "+ New" dropdown is open.
  protected readonly newMenuOpen = signal(false);
  // Viewport coords for the "+ New" dropdown (same fixed-positioning pattern as rowMenuPos).
  protected readonly newMenuPos = signal<{ top: number; right: number } | null>(null);

  // Form state for New Project modal.
  protected readonly newProject = { name: "" };

  // Form state for New Machine Account modal (write field removed — per-token now).
  // eslint-disable-next-line @typescript-eslint/prefer-readonly -- reassigned in openNewMachineAccount
  protected newMachineAccount = { name: "" };

  // Secret bulk-select state.
  protected readonly selectedSecretIds = signal<Set<string>>(new Set());
  protected readonly bulkDeletePending = signal(false);

  // Machine account view/delete state.
  protected readonly pendingDeleteMachine = signal<MachineAccount | null>(null);
  protected readonly pendingDeleteMachinesBulk = signal<MachineAccount[]>([]);
  protected readonly selectedMachineIds = signal<Set<string>>(new Set());

  // MA detail view state
  protected readonly maDetailTab = signal<
    "projects" | "people" | "access-tokens" | "event-logs" | "config"
  >("access-tokens");
  protected readonly viewingMaDetail = signal<MachineAccount | null>(null);
  protected readonly maDetailProjects = signal<MachineAccountProjectGrantListItem[]>([]);
  protected readonly maDetailTokens = signal<AccessTokenListItem[]>([]);
  protected readonly maDetailAuditEvents = signal<AuditEvent[]>([]);
  protected readonly maDetailAuditLoading = signal(false);

  // Create access token sub-modal form
  // eslint-disable-next-line @typescript-eslint/prefer-readonly -- reassigned in openCreateAccessToken
  protected newAccessToken = { name: "", expiresAt: "", write: true };

  // Revoke access token confirm
  protected readonly pendingRevokeToken = signal<AccessTokenListItem | null>(null);

  // MA project-grants edit state (Projects tab of detail)
  protected readonly maProjectGrantDraft = signal<
    Array<{ projectId: string; label: string; write: boolean; selected: boolean }>
  >([]);

  // Audit date range inputs
  // eslint-disable-next-line @typescript-eslint/prefer-readonly -- reassigned in loadAuditEvents
  protected auditFrom = "";
  // eslint-disable-next-line @typescript-eslint/prefer-readonly -- reassigned in loadAuditEvents
  protected auditTo = "";

  // Project view MA grants tab state
  protected readonly viewProjectTab = signal<"secrets" | "machine-accounts">("secrets");
  protected readonly projectMaGrantDraft = signal<
    Array<{ machineAccountId: string; name: string; write: boolean; selected: boolean }>
  >([]);

  // Secret edit MA grants tab state
  protected readonly editSecretTab = signal<"value" | "machine-accounts">("value");
  protected readonly secretMaGrantDraft = signal<
    Array<{ machineAccountId: string; name: string; write: boolean; selected: boolean }>
  >([]);

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

  protected readonly editSecret = {
    id: "",
    name: "",
    value: "",
    note: "",
    projectId: "",
  };

  protected readonly editProject = {
    id: "",
    name: "",
  };

  protected readonly pendingDeleteSecret = signal<DecryptedSecret | null>(null);
  protected readonly pendingDeleteProject = signal<DecryptedProject | null>(null);
  protected readonly viewProject = signal<DecryptedProject | null>(null);

  protected readonly organizations = computed(() => this.state()?.organizations ?? []);
  protected readonly selectedOrg = computed(() => {
    const orgId = this.selectedOrgId();
    return this.organizations().find((org) => org.id === orgId) ?? null;
  });


  // eslint-disable-next-line @typescript-eslint/prefer-readonly -- reassigned in ngOnInit
  private userId: UserId | null = null;
  // eslint-disable-next-line @typescript-eslint/prefer-readonly -- reassigned in ngOnInit
  private userKey: UserKey | null = null;
  // eslint-disable-next-line @typescript-eslint/prefer-readonly -- reassigned when org key is loaded
  private bwsOrgKey: SymmetricCryptoKey | null = null;
  // The account asymmetric keypair (SPKI / PKCS#8 DER). The org-key envelope is wrapped under
  // the PUBLIC key so it survives master-key rotation (unlike the legacy symmetric user-key wrap).
  // eslint-disable-next-line @typescript-eslint/prefer-readonly -- reassigned in ngOnInit
  private userPublicKey: Uint8Array | null = null;
  // eslint-disable-next-line @typescript-eslint/prefer-readonly -- reassigned in ngOnInit
  private userPrivateKey: Uint8Array | null = null;

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
      // Load the account keypair (consistent public+private). The org-key envelope is sealed
      // under the public key; rotation preserves the keypair, so the envelope survives rotation.
      const keyPair = await firstValueFrom(this.keyService.userEncryptionKeyPair$(this.userId));
      this.userPublicKey = (keyPair?.publicKey as Uint8Array | undefined) ?? null;
      this.userPrivateKey = (keyPair?.privateKey as Uint8Array | undefined) ?? null;
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
    this.selectedSecretIds.set(new Set());
    this.selectedMachineIds.set(new Set());
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
    const prevMode = this.modalMode();
    this.modalMode.set(null);
    // After token-display that was triggered from MA detail, re-open detail
    if (prevMode === "token" && this.viewingMaDetail()) {
      this.modalMode.set("ma-detail");
    }
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
      const encryptedOrgKey = await this.wrapOrgKeyForUser(bwsKey);
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

  protected toggleRowMenu(kind: "secret" | "project" | "machine", id: string, ev?: Event): void {
    const current = this.rowMenu();
    const opening = !(current && current.kind === kind && current.id === id);
    if (opening && ev?.currentTarget instanceof HTMLElement) {
      // Anchor the menu just under the trigger in VIEWPORT coords. The menu is
      // position:fixed, so it is not clipped by the table wrapper's / host's overflow
      // (which was swallowing the dropdown for the last/only row).
      const r = ev.currentTarget.getBoundingClientRect();
      this.rowMenuPos.set({
        top: Math.round(r.bottom + 4),
        right: Math.round(window.innerWidth - r.right),
      });
    }
    this.rowMenu.set(opening ? { kind, id } : null);
    if (!opening) {
      this.rowMenuPos.set(null);
    }
  }

  protected isRowMenuOpen(kind: "secret" | "project" | "machine", id: string): boolean {
    const current = this.rowMenu();
    return !!current && current.kind === kind && current.id === id;
  }

  protected startEditSecret(secret: DecryptedSecret): void {
    this.rowMenu.set(null);
    this.error.set(null);
    this.editSecret.id = secret.id;
    this.editSecret.name = secret.label;
    this.editSecret.value = secret.secretValue;
    this.editSecret.note = secret.noteText;
    this.editSecret.projectId = secret.projectId ?? "";
    this.editSecretTab.set("value");
    this.modalMode.set("edit-secret");
  }

  protected async saveEditSecret(): Promise<void> {
    const org = this.selectedOrg();
    if (!org || !this.bwsOrgKey) {
      this.error.set("This organization does not have a decryptable BWS key envelope.");
      return;
    }
    if (!this.editSecret.name.trim()) {
      this.error.set("Secret name is required.");
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.smAdminService.updateSecret(org.id, this.editSecret.id, {
        key: this.encStringValue(
          await this.encryptService.encryptString(this.editSecret.name.trim(), this.bwsOrgKey),
        ),
        value: this.encStringValue(
          await this.encryptService.encryptString(this.editSecret.value, this.bwsOrgKey),
        ),
        note: this.encStringValue(
          await this.encryptService.encryptString(this.editSecret.note, this.bwsOrgKey),
        ),
        projectIds: this.editSecret.projectId ? [this.editSecret.projectId] : [],
      });
      await this.refreshState();
      this.modalMode.set(null);
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected askDeleteSecret(secret: DecryptedSecret): void {
    this.rowMenu.set(null);
    this.error.set(null);
    this.pendingDeleteSecret.set(secret);
    this.modalMode.set("delete-secret");
  }

  protected async confirmDeleteSecret(): Promise<void> {
    const org = this.selectedOrg();
    const secret = this.pendingDeleteSecret();
    if (!org || !secret) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.smAdminService.deleteSecrets(org.id, [secret.id]);
      this.pendingDeleteSecret.set(null);
      await this.refreshState();
      this.modalMode.set(null);
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected askDeleteProject(project: DecryptedProject): void {
    this.rowMenu.set(null);
    this.error.set(null);
    this.pendingDeleteProject.set(project);
    this.modalMode.set("delete-project");
  }

  protected async confirmDeleteProject(): Promise<void> {
    const org = this.selectedOrg();
    const project = this.pendingDeleteProject();
    if (!org || !project) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.smAdminService.deleteProject(org.id, project.id);
      this.pendingDeleteProject.set(null);
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

  /** Toggle the "+ New" dropdown anchored to the trigger button in viewport coords. */
  protected toggleNewMenu(ev: MouseEvent): void {
    const open = !this.newMenuOpen();
    if (open && ev.currentTarget instanceof HTMLElement) {
      const r = ev.currentTarget.getBoundingClientRect();
      this.newMenuPos.set({
        top: Math.round(r.bottom + 4),
        right: Math.round(window.innerWidth - r.right),
      });
    } else {
      this.newMenuPos.set(null);
    }
    this.newMenuOpen.set(open);
  }

  /** Close the "+ New" dropdown (called from the overlay click). */
  protected closeNewMenu(): void {
    this.newMenuOpen.set(false);
    this.newMenuPos.set(null);
  }

  /** Open the New Project modal from the dropdown. */
  protected openNewProject(): void {
    this.closeNewMenu();
    if (!this.selectedOrg()) {
      this.openProvision();
      return;
    }
    if (this.orgKeyStatus()) {
      this.error.set(this.orgKeyStatus());
      return;
    }
    this.newProject.name = "";
    this.error.set(null);
    this.modalMode.set("new-project");
  }

  /** Create a project: encrypt name with bwsOrgKey, POST to /_admin/orgs/<id>/projects. */
  protected async createProject(): Promise<void> {
    const org = this.selectedOrg();
    if (!org || !this.bwsOrgKey) {
      this.error.set("This organization does not have a decryptable BWS key envelope.");
      return;
    }
    if (!this.newProject.name.trim()) {
      this.error.set("Project name is required.");
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const encryptedName = await this.encryptService.encryptString(
        this.newProject.name.trim(),
        this.bwsOrgKey,
      );
      await this.smAdminService.createProject(org.id, {
        name: this.encStringValue(encryptedName),
      });
      this.newProject.name = "";
      await this.refreshState();
      this.modalMode.set(null);
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  /** Open the New Machine Account modal from the dropdown. */
  protected openNewMachineAccount(): void {
    this.closeNewMenu();
    if (!this.selectedOrg()) {
      this.openProvision();
      return;
    }
    if (this.orgKeyStatus()) {
      this.error.set(this.orgKeyStatus());
      return;
    }
    this.newMachineAccount = { name: "" };
    this.error.set(null);
    this.modalMode.set("new-machine-account");
  }

  /** Create a machine account shell (name only), then open detail for token creation. */
  protected async createMachineAccount(): Promise<void> {
    const org = this.selectedOrg();
    if (!org) {
      this.error.set("No organization selected.");
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      // Step 1: Create the MA shell (name only)
      const response = await this.smAdminService.createMachineAccountV2(org.id, {
        name: this.newMachineAccount.name.trim(),
      });
      await this.refreshState();
      // Step 2: Open detail view on the new MA so the user can create tokens there
      const newMa: MachineAccount = {
        id: response.id,
        name: this.newMachineAccount.name.trim(),
        allProjects: false,
        projectCount: 0,
        tokenCount: 0,
      };
      this.newMachineAccount = { name: "" };
      this.modalMode.set(null);
      await this.openMaDetail(newMa);
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  // --- Secret bulk-select and copy actions ---

  protected copySecretName(secret: DecryptedSecret): void {
    this.rowMenu.set(null);
    void navigator.clipboard.writeText(secret.label);
  }

  protected copySecretValue(secret: DecryptedSecret): void {
    this.rowMenu.set(null);
    void navigator.clipboard.writeText(secret.secretValue);
  }

  protected toggleSecretSelection(id: string): void {
    const current = this.selectedSecretIds();
    const next = new Set(current);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedSecretIds.set(next);
  }

  protected isSecretSelected(id: string): boolean {
    return this.selectedSecretIds().has(id);
  }

  protected allSecretsSelected(preview: boolean): boolean {
    const visible = this.visibleSecrets(preview);
    if (visible.length === 0) {
      return false;
    }
    const sel = this.selectedSecretIds();
    return visible.every((s) => sel.has(s.id));
  }

  protected toggleSelectAllSecrets(preview: boolean): void {
    const visible = this.visibleSecrets(preview);
    if (this.allSecretsSelected(preview)) {
      const next = new Set(this.selectedSecretIds());
      visible.forEach((s) => next.delete(s.id));
      this.selectedSecretIds.set(next);
    } else {
      const next = new Set(this.selectedSecretIds());
      visible.forEach((s) => next.add(s.id));
      this.selectedSecretIds.set(next);
    }
  }

  protected askBulkDeleteSecrets(): void {
    if (this.selectedSecretIds().size === 0) {
      return;
    }
    this.error.set(null);
    this.bulkDeletePending.set(true);
    this.modalMode.set("delete-secrets-bulk");
  }

  protected async confirmBulkDeleteSecrets(): Promise<void> {
    const org = this.selectedOrg();
    const ids = [...this.selectedSecretIds()];
    if (!org || ids.length === 0) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.smAdminService.deleteSecrets(org.id, ids);
      this.selectedSecretIds.set(new Set());
      this.bulkDeletePending.set(false);
      await this.refreshState();
      this.modalMode.set(null);
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  // --- Project view/edit actions ---

  protected openViewProject(project: DecryptedProject): void {
    this.rowMenu.set(null);
    this.error.set(null);
    this.viewProject.set(project);
    this.viewProjectTab.set("secrets");
    this.projectMaGrantDraft.set([]);
    this.modalMode.set("view-project");
  }

  protected startEditProject(project: DecryptedProject): void {
    this.rowMenu.set(null);
    this.error.set(null);
    this.editProject.id = project.id;
    this.editProject.name = project.label;
    this.modalMode.set("edit-project");
  }

  protected async saveEditProject(): Promise<void> {
    const org = this.selectedOrg();
    if (!org) {
      this.error.set("No organization selected.");
      return;
    }
    const name = this.editProject.name.trim();
    if (!name) {
      this.error.set("Project name is required.");
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.smAdminService.updateProject(org.id, this.editProject.id, {
        displayName: name,
      });
      await this.refreshState();
      this.modalMode.set(null);
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected projectSecrets(projectId: string): DecryptedSecret[] {
    return this.decryptedSecrets().filter((s) => s.projectId === projectId);
  }

  // --- Machine account actions ---

  protected async openMaDetail(account: MachineAccount): Promise<void> {
    this.rowMenu.set(null);
    this.error.set(null);
    this.viewingMaDetail.set(account);
    this.maDetailTab.set("access-tokens");
    this.maDetailProjects.set([]);
    this.maDetailTokens.set([]);
    this.maDetailAuditEvents.set([]);
    this.modalMode.set("ma-detail");
    await this.refreshMaDetail(account);
  }

  private async refreshMaDetail(account: MachineAccount): Promise<void> {
    const org = this.selectedOrg();
    if (!org) {
      return;
    }
    try {
      const [tokens, grants] = await Promise.all([
        this.smAdminService.listAccessTokens(org.id, account.id),
        this.smAdminService.getMachineAccountProjects(org.id, account.id),
      ]);
      this.maDetailTokens.set(tokens);
      this.maDetailProjects.set(grants);
      // Build project-grant draft from the full project list + existing grants
      const grantMap = new Map(grants.map((g) => [g.projectId, g.write]));
      const draft = this.decryptedProjects().map((proj) => ({
        projectId: proj.id,
        label: proj.label,
        write: grantMap.get(proj.id) ?? false,
        selected: grantMap.has(proj.id),
      }));
      this.maProjectGrantDraft.set(draft);
    } catch (err) {
      this.error.set(this.messageFromError(err));
    }
  }

  protected setMaDetailTab(
    tab: "projects" | "people" | "access-tokens" | "event-logs" | "config",
  ): void {
    this.maDetailTab.set(tab);
  }

  protected async saveMaProjectGrants(): Promise<void> {
    const org = this.selectedOrg();
    const ma = this.viewingMaDetail();
    if (!org || !ma) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const projects = this.maProjectGrantDraft()
        .filter((p) => p.selected)
        .map((p) => ({ projectId: p.projectId, write: p.write }));
      await this.smAdminService.setMachineAccountProjects(org.id, ma.id, { projects });
      await this.refreshMaDetail(ma);
    } catch (err) {
      this.error.set(this.messageFromError(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleMaProjectGrant(
    projectId: string,
    field: "selected" | "write",
    value: boolean,
  ): void {
    this.maProjectGrantDraft.update((draft) =>
      draft.map((p) => (p.projectId === projectId ? { ...p, [field]: value } : p)),
    );
  }

  protected openCreateAccessToken(): void {
    this.newAccessToken = { name: "", expiresAt: "", write: true };
    this.error.set(null);
    this.modalMode.set("ma-create-token");
  }

  protected async createAccessToken(): Promise<void> {
    const org = this.selectedOrg();
    const ma = this.viewingMaDetail();
    if (!org || !ma || !this.bwsOrgKey) {
      this.error.set("Organization key not available.");
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.generatedAccessToken.set(null);
    try {
      const clientSecret = this.randomSecret();
      const seed = this.randomBytes(16);
      const tokenKey = await this.deriveTokenKey(seed);
      const encryptedPayload = await this.encryptService.encryptString(
        JSON.stringify({ encryptionKey: this.bwsOrgKey.toBase64() }),
        tokenKey,
      );
      const response = await this.smAdminService.createAccessToken(org.id, ma.id, {
        name: this.newAccessToken.name.trim(),
        expiresAt: this.newAccessToken.expiresAt.trim() || null,
        clientSecret,
        encryptedPayload: this.encStringValue(encryptedPayload),
        write: this.newAccessToken.write,
      });
      this.generatedAccessToken.set(
        `0.${response.clientId}.${clientSecret}:${this.b64(seed)}`,
      );
      // Close create modal, show token modal; closeModal() will re-open detail
      this.modalMode.set("token");
      await this.refreshMaDetail(ma);
    } catch (err) {
      this.error.set(this.messageFromError(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected askRevokeToken(token: AccessTokenListItem): void {
    this.pendingRevokeToken.set(token);
    this.modalMode.set("ma-delete-token");
  }

  protected async confirmRevokeToken(): Promise<void> {
    const org = this.selectedOrg();
    const ma = this.viewingMaDetail();
    const token = this.pendingRevokeToken();
    if (!org || !ma || !token) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.smAdminService.revokeAccessToken(org.id, ma.id, token.clientId);
      this.pendingRevokeToken.set(null);
      this.modalMode.set("ma-detail");
      await this.refreshMaDetail(ma);
    } catch (err) {
      this.error.set(this.messageFromError(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadAuditEvents(): Promise<void> {
    const org = this.selectedOrg();
    const ma = this.viewingMaDetail();
    if (!org || !ma) {
      return;
    }
    // Default range: last 7 days
    const to = this.auditTo.trim() || new Date().toISOString();
    const from = this.auditFrom.trim() || new Date(Date.now() - 7 * 86400_000).toISOString();
    this.maDetailAuditLoading.set(true);
    this.error.set(null);
    try {
      const resp = await this.smAdminService.getAuditEvents(org.id, from, to);
      // Filter client-side to events involving this MA (actorId or resourceId === ma.id)
      this.maDetailAuditEvents.set(
        resp.events.filter((e) => e.actorId === ma.id || e.resourceId === ma.id),
      );
    } catch (err) {
      this.error.set(this.messageFromError(err));
    } finally {
      this.maDetailAuditLoading.set(false);
    }
  }

  protected bwsOrgKeyAvailable(): boolean {
    return this.bwsOrgKey !== null;
  }

  protected copyText(text: string): void {
    void navigator.clipboard.writeText(text);
  }

  protected askDeleteMachine(account: MachineAccount): void {
    this.rowMenu.set(null);
    this.pendingDeleteMachine.set(account);
    this.modalMode.set("delete-machine");
  }

  protected async confirmDeleteMachine(): Promise<void> {
    const org = this.selectedOrg();
    const account = this.pendingDeleteMachine();
    if (!org || !account) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.smAdminService.deleteMachineAccount(org.id, account.id);
      this.pendingDeleteMachine.set(null);
      this.selectedMachineIds.set(new Set());
      await this.refreshState();
      this.modalMode.set(null);
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected openDeleteMachinesBulk(): void {
    const org = this.selectedOrg();
    if (!org) {
      return;
    }
    const selected = this.selectedMachineIds();
    const accounts = org.machineAccounts.filter((a) => selected.has(a.id));
    if (accounts.length === 0) {
      return;
    }
    this.pendingDeleteMachinesBulk.set(accounts);
    this.modalMode.set("delete-machines-bulk");
  }

  protected async confirmDeleteMachinesBulk(): Promise<void> {
    const org = this.selectedOrg();
    const accounts = this.pendingDeleteMachinesBulk();
    if (!org || accounts.length === 0) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      for (const account of accounts) {
        await this.smAdminService.deleteMachineAccount(org.id, account.id);
      }
      this.pendingDeleteMachinesBulk.set([]);
      this.selectedMachineIds.set(new Set());
      await this.refreshState();
      this.modalMode.set(null);
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleMachineSelection(id: string): void {
    const current = new Set(this.selectedMachineIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedMachineIds.set(current);
  }

  protected toggleAllMachines(): void {
    const org = this.selectedOrg();
    if (!org) {
      return;
    }
    const all = org.machineAccounts;
    const current = this.selectedMachineIds();
    if (current.size === all.length) {
      this.selectedMachineIds.set(new Set());
    } else {
      this.selectedMachineIds.set(new Set(all.map((a) => a.id)));
    }
  }

  protected isMachineSelected(id: string): boolean {
    return this.selectedMachineIds().has(id);
  }

  protected allMachinesSelected(): boolean {
    const org = this.selectedOrg();
    if (!org || org.machineAccounts.length === 0) {
      return false;
    }
    return this.selectedMachineIds().size === org.machineAccounts.length;
  }

  protected selectedMachineCount(): number {
    return this.selectedMachineIds().size;
  }

  protected machineIdentityUrl(): string {
    return `${window.location.origin}/identity`;
  }

  protected machineApiUrl(): string {
    return `${window.location.origin}/api`;
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

  // --- Project MA grants ---

  protected async loadProjectMaGrants(projectId: string): Promise<void> {
    const org = this.selectedOrg();
    if (!org) {
      return;
    }
    try {
      const currentGrants = await this.smAdminService.getProjectMachineAccounts(org.id, projectId);
      const grantMap = new Map(currentGrants.map((g) => [g.machineAccountId, g.write]));
      const draft = (org.machineAccounts ?? []).map((ma) => ({
        machineAccountId: ma.id,
        name: ma.name || ma.id,
        write: grantMap.get(ma.id) ?? false,
        selected: grantMap.has(ma.id),
      }));
      this.projectMaGrantDraft.set(draft);
    } catch (err) {
      this.error.set(this.messageFromError(err));
    }
  }

  protected toggleProjectMaGrant(
    maId: string,
    field: "selected" | "write",
    value: boolean,
  ): void {
    this.projectMaGrantDraft.update((draft) =>
      draft.map((g) => (g.machineAccountId === maId ? { ...g, [field]: value } : g)),
    );
  }

  protected async saveProjectMaGrants(projectId: string): Promise<void> {
    const org = this.selectedOrg();
    if (!org) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const machineAccounts = this.projectMaGrantDraft()
        .filter((g) => g.selected)
        .map((g) => ({ machineAccountId: g.machineAccountId, write: g.write }));
      await this.smAdminService.setProjectMachineAccounts(org.id, projectId, { machineAccounts });
    } catch (err) {
      this.error.set(this.messageFromError(err));
    } finally {
      this.loading.set(false);
    }
  }

  // --- Secret MA grants ---

  protected async loadSecretMaGrants(secretId: string): Promise<void> {
    const org = this.selectedOrg();
    if (!org || !secretId) {
      return;
    }
    try {
      const grants = await this.smAdminService.getSecretMachineAccounts(org.id, secretId);
      const grantMap = new Map(grants.map((g) => [g.machineAccountId, g.write]));
      const draft = (org.machineAccounts ?? []).map((ma) => ({
        machineAccountId: ma.id,
        name: ma.name || ma.id,
        write: grantMap.get(ma.id) ?? false,
        selected: grantMap.has(ma.id),
      }));
      this.secretMaGrantDraft.set(draft);
    } catch (err) {
      this.error.set(this.messageFromError(err));
    }
  }

  protected toggleSecretMaGrant(
    maId: string,
    field: "selected" | "write",
    value: boolean,
  ): void {
    this.secretMaGrantDraft.update((draft) =>
      draft.map((g) => (g.machineAccountId === maId ? { ...g, [field]: value } : g)),
    );
  }

  protected async saveSecretMaGrants(): Promise<void> {
    const org = this.selectedOrg();
    if (!org || !this.editSecret.id) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const machineAccounts = this.secretMaGrantDraft()
        .filter((g) => g.selected)
        .map((g) => ({ machineAccountId: g.machineAccountId, write: g.write }));
      await this.smAdminService.setSecretMachineAccounts(org.id, this.editSecret.id, {
        machineAccounts,
      });
    } catch (err) {
      this.error.set(this.messageFromError(err));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSelectedOrg(): Promise<void> {
    const org = this.selectedOrg();
    this.decryptedProjects.set([]);
    this.decryptedSecrets.set([]);
    this.bwsOrgKey = null;
    this.orgKeyStatus.set(null);
    this.orgKeyNeedsRelink.set(false);
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

      const encStr = new EncString(envelope.encryptedOrgKey);
      this.bwsOrgKey = await this.unwrapOrgKeyEnvelope(encStr);
      // Lazy migration: upgrade legacy symmetric (user-key-wrapped) envelopes to the
      // rotation-proof asymmetric form on first successful load. Best-effort.
      if (encStr.encryptionType === EncryptionType.AesCbc256_HmacSha256_B64 && this.userPublicKey) {
        try {
          const rewrapped = await this.wrapOrgKeyForUser(this.bwsOrgKey);
          await this.smAdminService.setOrgUserKey(org.id, this.encStringValue(rewrapped));
        } catch {
          /* migration is opportunistic; a failure here does not block decryption */
        }
      }

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
      // Envelope present but unwrap failed — almost always a rotated account key. Offer recovery.
      this.orgKeyNeedsRelink.set(true);
      this.orgKeyStatus.set(
        `${this.messageFromError(error)} — your account key may have changed. Re-link this organization with its access token to restore access.`,
      );
    }
  }

  /** Open the "Re-link organization" recovery modal. */
  protected openRelinkOrg(): void {
    this.relink.token = "";
    this.error.set(null);
    this.modalMode.set("relink-org");
  }

  /**
   * Recover web-UI access after a master-key rotation orphaned the org-key envelope.
   * The pasted access token carries the seed; the server returns that token's wrapped org-key
   * blob; we unwrap the org key locally, then re-wrap it under the new account public key.
   */
  protected async relinkOrg(): Promise<void> {
    const org = this.selectedOrg();
    if (!org) {
      return;
    }
    const raw = this.relink.token.trim();
    if (!raw) {
      this.error.set("Paste the organization's access token.");
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      // Access-token format: 0.<clientId>.<clientSecret>:<base64 seed>
      const body = raw.startsWith("0.") ? raw.slice(2) : raw;
      const colon = body.indexOf(":");
      if (colon < 0) {
        throw new Error("That does not look like a valid access token.");
      }
      const clientId = body.slice(0, colon).split(".")[0];
      const seedB64 = body.slice(colon + 1);
      if (!clientId || !seedB64) {
        throw new Error("That does not look like a valid access token.");
      }

      const envelope = await this.smAdminService.getMachineAccountEnvelope(org.id, clientId);
      const tokenKey = await this.deriveTokenKey(this.fromB64(seedB64));
      const payloadJson = await this.encryptService.decryptString(
        new EncString(envelope.encryptedPayload),
        tokenKey,
      );
      const parsed = JSON.parse(payloadJson) as { encryptionKey?: string };
      if (!parsed.encryptionKey) {
        throw new Error("The access token did not yield an organization key.");
      }
      const orgKey = new SymmetricCryptoKey(this.fromB64(parsed.encryptionKey));

      const rewrapped = await this.wrapOrgKeyForUser(orgKey);
      await this.smAdminService.setOrgUserKey(org.id, this.encStringValue(rewrapped));

      this.relink.token = "";
      this.orgKeyNeedsRelink.set(false);
      this.modalMode.set(null);
      await this.loadSelectedOrg();
    } catch (error) {
      this.error.set(this.messageFromError(error));
    } finally {
      this.loading.set(false);
    }
  }

  /** Wrap the BWS org key under the account's asymmetric PUBLIC key (rotation-proof). */
  private async wrapOrgKeyForUser(orgKey: SymmetricCryptoKey): Promise<EncString> {
    if (!this.userPublicKey) {
      throw new Error("Your account public key is unavailable; unlock your vault and retry.");
    }
    return this.encryptService.encapsulateKeyUnsigned(orgKey, this.userPublicKey);
  }

  /**
   * Unwrap the org-key envelope. New envelopes are asymmetric (RSA, sealed under the public
   * key); legacy envelopes are symmetric (wrapped under the rotatable user key).
   */
  private async unwrapOrgKeyEnvelope(envelope: EncString): Promise<SymmetricCryptoKey> {
    const type = envelope.encryptionType;
    const isAsymmetric =
      type === EncryptionType.Rsa2048_OaepSha256_B64 ||
      type === EncryptionType.Rsa2048_OaepSha1_B64 ||
      type === EncryptionType.Rsa2048_OaepSha256_HmacSha256_B64 ||
      type === EncryptionType.Rsa2048_OaepSha1_HmacSha256_B64;
    if (isAsymmetric) {
      if (!this.userPrivateKey) {
        throw new Error("Your account private key is unavailable; unlock your vault and retry.");
      }
      return this.encryptService.decapsulateKeyUnsigned(envelope, this.userPrivateKey);
    }
    if (!this.userKey) {
      throw new Error("Unlock your vault before opening Secrets Manager.");
    }
    return this.encryptService.unwrapSymmetricKey(envelope, this.userKey);
  }

  private fromB64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
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
