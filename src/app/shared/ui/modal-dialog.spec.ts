import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { ModalDialog } from './modal-dialog';
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
    expect(document.querySelector('.cdk-overlay-backdrop')).not.toBeNull();
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

  it('is dismissed by a click on the overlay', async () => {
    const { host, open, settle } = await render();
    await open();

    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
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
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
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
});
