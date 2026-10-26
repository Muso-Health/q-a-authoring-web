import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrentUser } from '../core/access/current-user';
import { AuthPort } from '../core/auth/auth-port';

/** "Awa Traoré" → "AT": the first letter of the first and last words; the email's, failing a name. */
export function initialsOf(displayName: string, email: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length === 0
      ? [email.trim()[0] ?? '?']
      : [words[0], ...(words.length > 1 ? [words[words.length - 1]] : [])].map(
          (word) => [...word][0],
        );
  return letters.join('').toLocaleUpperCase();
}

/**
 * The signed-in user, at the far end of the header — budgetisation's session badge, as a menu
 * like the language switcher beside it.
 *
 * WHO is `/me`'s answer (display name and email; never an identifier). It renders only once
 * `/me` has answered, so nobody the engine does not know is shown as signed in. The PHOTO is the
 * auth provider's (`AuthPort.photo`: Microsoft Graph under Entra, none under dev); until it
 * arrives, or if it never does, the initials stand in — in the same box, so a late photo moves no
 * other pixel. It is decorative (`alt=""`): the name is always right beside it.
 */
@Component({
  selector: 'app-user-menu',
  imports: [MatButtonModule, MatDividerModule, MatMenuModule, NgTemplateOutlet, TranslocoPipe],
  template: `
    @if (user.profile(); as me) {
      <ng-template #avatar let-size="size">
        @if (photo(); as face) {
          <img
            class="avatar"
            [class.large]="size === 'large'"
            [src]="face"
            alt=""
            [attr.width]="size === 'large' ? 40 : 28"
            [attr.height]="size === 'large' ? 40 : 28"
            (error)="photoBroken.set(true)"
          />
        } @else {
          <span class="avatar initials" [class.large]="size === 'large'" aria-hidden="true">{{
            initials()
          }}</span>
        }
      </ng-template>

      <button
        matButton
        type="button"
        class="trigger"
        [matMenuTriggerFor]="menu"
        [attr.aria-label]="'user.menuLabel' | transloco: { name: me.displayName, email: me.email }"
      >
        <span class="row">
          <ng-container *ngTemplateOutlet="avatar; context: { size: 'small' }" />
          <span class="name">{{ me.displayName }}</span>
        </span>
      </button>

      <mat-menu #menu="matMenu" xPosition="before" class="user-menu">
        <!--
          Shown, not announced: a menu holds menu items, and everything said here is already the
          trigger's accessible name.
        -->
        <div class="identity" aria-hidden="true">
          <ng-container *ngTemplateOutlet="avatar; context: { size: 'large' }" />
          <span class="who">
            <span class="caption">{{ 'user.signedInAs' | transloco }}</span>
            <span class="display-name">{{ me.displayName }}</span>
            <span class="email">{{ me.email }}</span>
          </span>
        </div>
        <mat-divider />
        <button mat-menu-item type="button" (click)="signOut()">
          <span class="row">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H10" />
            </svg>
            {{ 'user.signOut' | transloco }}
          </span>
        </button>
      </mat-menu>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    /* On the teal header: the header's own ink, and its white focus ring (set by the shell). */
    .trigger {
      --mat-button-text-label-text-color: var(--muso-chrome-fg);
      --mat-button-text-state-layer-color: var(--muso-chrome-fg);
      font-weight: 600;
    }
    /* Material wraps a button's content in its own label span, so the spacing lives in here. */
    .row {
      display: inline-flex;
      align-items: center;
      gap: var(--muso-space-2);
    }
    .name {
      white-space: nowrap;
    }
    .avatar {
      box-sizing: border-box;
      inline-size: 28px;
      block-size: 28px;
      flex: none;
      border-radius: 50%;
      object-fit: cover;
    }
    .avatar.large {
      inline-size: 40px;
      block-size: 40px;
    }
    .initials {
      display: inline-grid;
      place-items: center;
      background: var(--muso-navy);
      color: var(--muso-text-inverse);
      font-size: 0.75rem;
      font-weight: 700;
      line-height: 1;
    }
    .initials.large {
      font-size: 0.9375rem;
    }
    /* A hairline of white, so a dark photo or the navy disc keeps an edge against the teal. */
    .trigger .avatar {
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--muso-chrome-fg) 60%, transparent);
    }
    .identity {
      display: flex;
      align-items: center;
      gap: var(--muso-space-2);
      padding: var(--muso-space-2) var(--muso-space-3);
    }
    .who {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .caption {
      font-size: 0.75rem;
      color: var(--muso-text-muted);
    }
    .display-name {
      font-weight: 600;
    }
    .email {
      font-size: 0.875rem;
      color: var(--muso-text-muted);
      overflow-wrap: anywhere;
    }
    svg {
      inline-size: 1.25rem;
      block-size: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    /* On a narrow header the trigger is its avatar; its accessible name still says who. */
    @media (max-width: 40rem) {
      .name {
        display: none;
      }
      .trigger {
        --mat-button-text-horizontal-padding: calc(var(--muso-space-unit) / 2);
        min-inline-size: 0;
      }
    }
  `,
})
export class UserMenu {
  protected readonly user = inject(CurrentUser);
  readonly #auth = inject(AuthPort);

  /** A photo the browser could not decode: fall back to initials for the rest of the session. */
  protected readonly photoBroken = signal(false);
  protected readonly photo = computed(() => (this.photoBroken() ? null : this.#auth.photo()));

  protected readonly initials = computed(() => {
    const me = this.user.profile();
    return me === null ? '' : initialsOf(me.displayName, me.email);
  });

  protected signOut(): void {
    this.#auth.signOut().catch((error: unknown) => console.error(error));
  }
}
