import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../core/api/api-port';
import { FakeApiPort } from '../core/api/testing/fake-api-port';
import { AuthPort } from '../core/auth/auth-port';
import { FakeAuthPort } from '../core/auth/testing/fake-auth-port';
import { ME_AUTHOR } from '../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../core/i18n/testing/provide-test-i18n';
import type { UiLanguage } from '../core/i18n/translator';
import { UserMenu } from './user-menu';

async function render(
  options: { me?: unknown; photo?: string | null; language?: UiLanguage } = {},
) {
  const auth = new FakeAuthPort();
  auth.photo.set(options.photo ?? null);
  const answers =
    'me' in options
      ? options.me === undefined
        ? {}
        : { '/me': options.me }
      : { '/me': ME_AUTHOR };
  TestBed.configureTestingModule({
    imports: [UserMenu],
    providers: [
      provideTestI18n(options.language),
      { provide: ApiPort, useValue: new FakeApiPort(answers) },
      { provide: AuthPort, useValue: auth },
    ],
  });
  const fixture = TestBed.createComponent(UserMenu);
  document.body.appendChild(fixture.nativeElement);
  const stable = () => TestBed.inject(ApplicationRef).whenStable();
  await stable();
  const element = fixture.nativeElement as HTMLElement;
  const trigger = () => element.querySelector<HTMLButtonElement>('button.trigger');
  const panel = () => document.querySelector<HTMLElement>('.mat-mdc-menu-panel');
  const open = async () => {
    trigger()!.click();
    await stable();
    return panel()!;
  };
  return { fixture, element, auth, trigger, panel, open, stable };
}

describe('UserMenu', () => {
  afterEach(() => document.body.replaceChildren());

  it('names the signed-in user from /me, on the trigger and inside the menu', async () => {
    const { trigger, open } = await render();

    expect(trigger()?.textContent).toContain('Awa Traoré');
    expect(trigger()?.getAttribute('aria-label')).toBe(
      'Awa Traoré, author@example.org : menu du compte',
    );
    const panel = await open();
    expect(panel.textContent).toContain('Connecté en tant que');
    expect(panel.textContent).toContain('Awa Traoré');
    expect(panel.textContent).toContain('author@example.org');
  });

  it('never shows an identifier: no user id, no Entra object id', async () => {
    const { element, open } = await render();

    const panel = await open();
    for (const text of [element.innerHTML, panel.innerHTML]) {
      expect(text).not.toContain(ME_AUTHOR.id);
    }
  });

  it('shows initials while there is no photo', async () => {
    const { trigger, open } = await render();

    expect(trigger()?.querySelector('img')).toBeNull();
    expect(trigger()?.querySelector('.initials')?.textContent?.trim()).toBe('AT');
    expect((await open()).querySelector('.initials')?.textContent?.trim()).toBe('AT');
  });

  it('shows the photo when the auth provider has one, decoratively', async () => {
    const { trigger } = await render({ photo: 'blob:photo' });

    const img = trigger()?.querySelector('img');
    expect(img?.getAttribute('src')).toBe('blob:photo');
    expect(img?.getAttribute('alt')).toBe('');
    expect(trigger()?.querySelector('.initials')).toBeNull();
  });

  it('falls back to initials when the photo will not decode', async () => {
    const { trigger, stable } = await render({ photo: 'blob:broken' });

    trigger()!.querySelector('img')!.dispatchEvent(new Event('error'));
    await stable();

    expect(trigger()?.querySelector('img')).toBeNull();
    expect(trigger()?.querySelector('.initials')?.textContent?.trim()).toBe('AT');
  });

  it('logs out through AuthPort.signOut()', async () => {
    const { auth, open, stable } = await render();

    const panel = await open();
    const logOut = [...panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    expect(logOut.map((item) => item.textContent?.trim())).toEqual(['Se déconnecter']);
    logOut[0].click();
    await stable();

    expect(auth.signOuts).toBe(1);
  });

  it('is absent while nobody is signed in — /me has not answered', async () => {
    const { element } = await render({ me: undefined });

    expect(element.querySelector('button')).toBeNull();
  });

  it('opens from a focused trigger and gives focus back to it on Escape', async () => {
    const { trigger, panel, stable } = await render();

    // A native button: Enter and Space are a click, so the keyboard opens it exactly as this does.
    trigger()!.focus();
    trigger()!.click();
    await stable();
    expect(panel()).not.toBeNull();
    expect(trigger()?.getAttribute('aria-expanded')).toBe('true');

    panel()!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    await stable();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(trigger()?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('speaks English when English is chosen', async () => {
    const { trigger, open } = await render({ language: 'en' });

    expect(trigger()?.getAttribute('aria-label')).toBe(
      'Awa Traoré, author@example.org: account menu',
    );
    const panel = await open();
    expect(panel.textContent).toContain('Signed in as');
    expect(panel.querySelector('[role="menuitem"]')?.textContent?.trim()).toBe('Log out');
  });
});
