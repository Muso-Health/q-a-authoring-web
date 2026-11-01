import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { DialogHost, ModalDialog } from './modal-dialog';

/** What a compiled component or directive exposes, read to check its host bindings. */
interface DefLike {
  readonly hostBindings: unknown;
}
const hostBindingsOf = (type: unknown, def: 'ɵcmp' | 'ɵdir') =>
  String((type as Record<string, DefLike>)[def].hostBindings);

const ROOT = process.cwd();
/** The application's TypeScript sources, specs aside. */
function sources(dir = join(ROOT, 'src/app')): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
  });
}
import { fakeLayout } from './testing/fake-layout';

@Component({
  imports: [ModalDialog],
  template: `
    <button type="button" class="opener" (click)="open.set(true)">Ouvrir</button>
    @if (open()) {
      <app-dialog title="Un titre" [locked]="locked()" (dismissed)="dismiss()">
        <label>Champ <input class="first" cdkFocusInitial /></label>
        <button type="button" class="last" (click)="open.set(false)">Terminer</button>
      </app-dialog>
    }
  `,
})
class Host {
  readonly open = signal(false);
  readonly locked = signal(false);
  dismissals = 0;

  dismiss(): void {
    this.dismissals++;
    this.open.set(false);
  }
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const escape = () =>
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
  );

describe('ModalDialog', () => {
  beforeEach(fakeLayout);

  async function render() {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTestI18n()] });
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    const host = fixture.componentInstance;
    const opener = fixture.nativeElement.querySelector('.opener') as HTMLButtonElement;
    const settle = () => fixture.whenStable();
    const open = async () => {
      opener.focus();
      opener.click();
      await settle();
    };
    onTestFinished(() => fixture.nativeElement.remove());
    return { fixture, host, opener, open, settle };
  }

  it('opens a modal dialog labelled by its title, over the rest of the page', async () => {
    const { open } = await render();

    await open();

    expect(dialog()?.getAttribute('aria-modal')).toBe('true');
    const title = document.getElementById(dialog()!.getAttribute('aria-labelledby')!);
    expect(title?.textContent?.trim()).toBe('Un titre');
    expect(document.querySelector('app-dialog .muso-dialog-backdrop')).not.toBeNull();
  });

  it('moves focus into the dialog and keeps it there', async () => {
    const { open } = await render();

    await open();

    expect(document.activeElement).toBe(dialog()!.querySelector('.first'));
    // Tabbing past either end lands on the anchor that wraps focus back inside.
    const anchors = [...document.querySelectorAll<HTMLElement>('.cdk-focus-trap-anchor')];
    expect(anchors).toHaveLength(2);
    anchors[1].focus();
    expect(dialog()!.contains(document.activeElement)).toBe(true);
    anchors[0].focus();
    expect(dialog()!.contains(document.activeElement)).toBe(true);
  });

  it('is dismissed by Escape, and gives focus back to what opened it', async () => {
    const { host, opener, open, settle } = await render();
    await open();

    escape();
    await settle();

    expect(host.dismissals).toBe(1);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('is dismissed by a click on the backdrop', async () => {
    const { host, open, settle } = await render();
    await open();

    document.querySelector<HTMLElement>('.muso-dialog-backdrop')!.click();
    await settle();

    expect(host.dismissals).toBe(1);
    expect(dialog()).toBeNull();
  });

  it('is dismissed by its close button', async () => {
    const { host, opener, open, settle } = await render();
    await open();

    dialog()!.querySelector<HTMLButtonElement>('button[aria-label="Fermer"]')!.click();
    await settle();

    expect(host.dismissals).toBe(1);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('cannot be dismissed while locked', async () => {
    const { host, open, settle } = await render();
    host.locked.set(true);
    await open();

    escape();
    document.querySelector<HTMLElement>('.muso-dialog-backdrop')!.click();
    await settle();

    expect(host.dismissals).toBe(0);
    expect(dialog()).not.toBeNull();
    expect(
      dialog()!.querySelector<HTMLButtonElement>('button[aria-label="Fermer"]')!.disabled,
    ).toBe(true);

    host.locked.set(false);
    await settle();
    escape();
    await settle();
    expect(host.dismissals).toBe(1);
  });

  it('closes when its content is done, without counting as a dismissal, focus back on the opener', async () => {
    const { host, opener, open, settle } = await render();
    await open();

    dialog()!.querySelector<HTMLButtonElement>('.last')!.click();
    await settle();

    expect(dialog()).toBeNull();
    expect(host.dismissals).toBe(0);
    expect(document.activeElement).toBe(opener);
  });

  describe('structure', () => {
    it('renders in place as one layer: backdrop, then the panel holding title, content and ×', async () => {
      const { fixture, open } = await render();
      await open();

      const layer = fixture.nativeElement.querySelector('app-dialog') as HTMLElement;
      const panel = dialog()!;
      expect(layer.contains(panel)).toBe(true);
      // (The focus trap's two invisible anchors sit either side of the panel.)
      const parts = [...layer.children].filter(
        (c) => !c.classList.contains('cdk-focus-trap-anchor'),
      );
      expect(parts.map((child) => child.className)).toEqual([
        'muso-dialog-backdrop',
        'muso-dialog',
      ]);
      // The owner's content is projected into the panel itself, never portalled elsewhere.
      expect(panel.contains(panel.ownerDocument.querySelector('input.first'))).toBe(true);
      expect(panel.querySelector('.muso-dialog-title')?.textContent).toBe('Un titre');
      expect(panel.querySelector('.muso-dialog-close')).not.toBeNull();
      expect(document.querySelector('.cdk-overlay-container .muso-dialog')).toBeNull();
    });

    it('locks the page’s scroll while open, and gives it back once closed', async () => {
      const { fixture, open, settle } = await render();
      document.documentElement.style.overflow = 'auto';

      await open();
      expect(document.documentElement.style.overflow).toBe('hidden');

      dialog()!.querySelector<HTMLButtonElement>('.last')!.click();
      await settle();
      fixture.detectChanges();
      expect(document.documentElement.style.overflow).toBe('auto');
      document.documentElement.style.overflow = '';
    });
  });

  describe('motion: Angular’s animate.enter / animate.leave', () => {
    const css = readFileSync(join(ROOT, 'src/styles/_muso-dialog.scss'), 'utf8')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\s+/g, ' ');

    it('puts the enter and leave classes on the dialog’s host, the whole layer', () => {
      const bindings = hostBindingsOf(ModalDialog, 'ɵcmp');
      expect(bindings).toMatch(/animateEnter\(["']muso-dialog-entering["']\)/);
      expect(bindings).toMatch(/animateLeave\(["']muso-dialog-leaving["']\)/);
    });

    it('lets a component wrapping the dialog carry the same leave on its own host', () => {
      expect(hostBindingsOf(DialogHost, 'ɵdir')).toMatch(
        /animateLeave\(["']muso-dialog-leaving["']\)/,
      );
    });

    it('is carried by every component whose template is an <app-dialog>: Angular waits only on what the owner removes', () => {
      const wrappers = sources().filter((path) =>
        /template: `\s*<app-dialog\b/.test(readFileSync(path, 'utf8')),
      );
      expect(wrappers.length).toBeGreaterThan(0);
      for (const path of wrappers) {
        const source = readFileSync(path, 'utf8');
        // Each wrapper's @Component block that opens on <app-dialog> declares DialogHost.
        for (const block of source.split('@Component(').slice(1)) {
          if (!/template: `\s*<app-dialog\b/.test(block)) continue;
          expect(block, path).toMatch(/hostDirectives: \[[^\]]*\bDialogHost\b/);
        }
      }
    });

    it('fades the layer in over 300ms ease-out, the panel rising from 16px lower at 0.96', () => {
      expect(css).toContain(
        '.muso-dialog-entering { animation: muso-dialog-fade-in 300ms ease-out',
      );
      expect(css).toContain(
        '.muso-dialog-entering .muso-dialog { animation: muso-dialog-rise-in 300ms ease-out',
      );
      expect(css).toMatch(
        /muso-dialog-rise-in \{ from \{ transform: translateY\(16px\) scale\(0\.96\)/,
      );
      expect(css).toMatch(/muso-dialog-fade-in \{ from \{ opacity: 0; \} to \{ opacity: 1; \}/);
    });

    it('plays it in reverse over 250ms ease-in on leave', () => {
      expect(css).toContain('.muso-dialog-leaving { animation: muso-dialog-fade-out 250ms ease-in');
      expect(css).toContain(
        '.muso-dialog-leaving .muso-dialog { animation: muso-dialog-sink-out 250ms ease-in',
      );
      expect(css).toMatch(
        /muso-dialog-sink-out \{ from \{ transform: translateY\(0\) scale\(1\); \} to \{ transform: translateY\(16px\) scale\(0\.96\)/,
      );
    });

    it('drops the animation only under prefers-reduced-motion: reduce', () => {
      const reduced = /@media \(prefers-reduced-motion: reduce\) \{([^@]*)\}/.exec(css);
      expect(reduced?.[1]).toContain('animation: none');
      // Outside that query, nothing turns the animation off.
      expect(css.replace(reduced![0], '')).not.toContain('animation: none');
    });
  });
});
