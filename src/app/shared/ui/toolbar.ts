import { Component, input } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { FocusReturnTarget } from './focus-return';
import { Icon, type IconName } from './icon';

/** One tool: what it shows, what it is called, and what it does. */
export interface ToolbarAction {
  /** Unique on the page: also the key focus returns to (`FocusReturn.to(id)`) once it is done. */
  readonly id: string;
  readonly icon: IconName;
  /** The tool's name: its accessible name and its tooltip. */
  readonly label: string;
  readonly disabled?: boolean;
  readonly handler: () => void;
}

/**
 * A row of icon-only tools, each named by a tooltip and an `aria-label`. A disabled tool stays
 * focusable and named — so focus is never lost while a call runs, and its name can still be
 * read — but does nothing. Every tool is a Tab stop; the arrows, Home and End move between them.
 */
@Component({
  selector: 'app-toolbar',
  imports: [MatTooltip, FocusReturnTarget, Icon],
  template: `
    <div role="toolbar" class="toolbar" [attr.aria-label]="label()" (keydown)="move($event)">
      @for (action of actions(); track action.id) {
        <button
          type="button"
          class="tool"
          [attr.aria-label]="action.label"
          [attr.aria-disabled]="action.disabled ? 'true' : null"
          [matTooltip]="action.label"
          [appFocusReturn]="action.id"
          (click)="run(action)"
        >
          <app-icon [name]="action.icon" />
        </button>
      }
    </div>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
    }
    .tool {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 2.75rem;
      block-size: 2.75rem;
      padding: 0;
      color: var(--muso-navy);
      background: var(--muso-surface);
      border: 1px solid var(--muso-border);
      border-radius: var(--muso-radius);
      box-shadow: none;
    }
    .tool:not([aria-disabled='true']):hover {
      color: var(--muso-white);
      background: var(--muso-teal);
      border-color: var(--muso-teal);
    }
    .tool[aria-disabled='true'] {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none;
    }
  `,
})
export class Toolbar {
  /** Names the group for assistive technology: « Outils de la variante 2 ». */
  readonly label = input.required<string>();
  readonly actions = input.required<readonly ToolbarAction[]>();

  protected run(action: ToolbarAction): void {
    if (!action.disabled) action.handler();
  }

  protected move(event: KeyboardEvent): void {
    const tools = [
      ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('.tool'),
    ];
    const at = tools.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const next = {
      ArrowRight: (at + 1) % tools.length,
      ArrowDown: (at + 1) % tools.length,
      ArrowLeft: (at - 1 + tools.length) % tools.length,
      ArrowUp: (at - 1 + tools.length) % tools.length,
      Home: 0,
      End: tools.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    tools[next].focus();
  }
}
