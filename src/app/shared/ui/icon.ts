import { Component, computed, input } from '@angular/core';

/**
 * An icon is either an SVG path on a 24×24 grid — today's placeholders — or an image file. To
 * swap a placeholder for a designed asset, replace its entry with `{ src: 'icons/edit.svg' }`
 * (a file under `public/`); nothing that uses the icon changes.
 */
export type IconSource = { readonly path: string } | { readonly src: string };

export const ICONS = {
  edit: {
    path: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  },
  delete: {
    path: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  },
  audio: {
    path: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z',
  },
  generate: {
    path: 'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z',
  },
  translate: {
    path: 'M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z',
  },
  'category-add': {
    path: 'M21 12l-4.37 6.16c-.36.51-.96.84-1.63.84h-3v-6H9v-3H3V7c0-1.1.9-2 2-2h10c.67 0 1.27.33 1.63.84L21 12zM10 15H7v-3H5v3H2v2h3v3h2v-3h3v-2z',
  },
  'category-remove': {
    path: 'M21 12l-4.37 6.16c-.36.51-.96.84-1.63.84h-3v-6H3V7c0-1.1.9-2 2-2h10c.67 0 1.27.33 1.63.84L21 12zM10 15H2v2h8v-2z',
  },
  'intent-add': {
    path: 'M22 4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14l4 4V4zm-5 7h-4v4h-2v-4H7V9h4V5h2v4h4v2z',
  },
  'intent-remove': {
    path: 'M22 4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14l4 4V4zm-5 7H7V9h10v2z',
  },
} as const satisfies Record<string, IconSource>;

export type IconName = keyof typeof ICONS;

/** Decorative: whatever carries the icon names it (an `aria-label`), so the icon is hidden. */
@Component({
  selector: 'app-icon',
  template: `
    @let icon = source();
    @if ('src' in icon) {
      <img [src]="icon.src" alt="" aria-hidden="true" />
    } @else {
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path [attr.d]="icon.path" />
      </svg>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      inline-size: 1.25rem;
      block-size: 1.25rem;
    }
    svg,
    img {
      inline-size: 100%;
      block-size: 100%;
    }
    svg {
      fill: currentColor;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly source = computed<IconSource>(() => ICONS[this.name()]);
}
