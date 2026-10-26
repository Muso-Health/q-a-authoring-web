import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { MemoryStorage } from '../core/i18n/testing/memory-storage';
import { provideTestI18n } from '../core/i18n/testing/provide-test-i18n';
import { LANGUAGE_STORAGE_KEY, Translator, type UiLanguage } from '../core/i18n/translator';
import { LanguageSwitcher } from './language-switcher';

async function render(language: UiLanguage = 'fr', storage = new MemoryStorage()) {
  TestBed.configureTestingModule({
    imports: [LanguageSwitcher],
    providers: [provideTestI18n(language, storage)],
  });
  const fixture = TestBed.createComponent(LanguageSwitcher);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const trigger = () => element.querySelector<HTMLButtonElement>('button')!;
  const open = async () => {
    trigger().click();
    await fixture.whenStable();
    // The menu renders in Material's overlay, outside the component.
    return [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
  };
  return { fixture, trigger, open, storage, translator: TestBed.inject(Translator) };
}

describe('LanguageSwitcher', () => {
  it('shows the language in play, named so a screen reader says what it is for', async () => {
    const { trigger } = await render('fr');

    expect(trigger().textContent?.trim()).toBe('FR');
    expect(trigger().getAttribute('aria-label')).toBe('Langue : FR. Choisir une langue');
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
  });

  it('offers both languages, each named in itself, the one in play checked', async () => {
    const { open } = await render('fr');

    const items = await open();

    expect(items.map((item) => item.textContent?.trim())).toEqual(['Français', 'English']);
    expect(items.map((item) => item.getAttribute('lang'))).toEqual(['fr', 'en']);
    expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual(['true', 'false']);
  });

  it('switches live through Transloco and remembers the choice', async () => {
    const { fixture, trigger, open, storage, translator } = await render('fr');
    const setActiveLang = vi.spyOn(TestBed.inject(TranslocoService), 'setActiveLang');

    (await open())[1].click();
    await fixture.whenStable();

    expect(translator.language()).toBe('en');
    expect(setActiveLang).toHaveBeenCalledWith('en');
    expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(trigger().textContent?.trim()).toBe('EN');
    // Its own labels follow the switch.
    expect(trigger().getAttribute('aria-label')).toBe('Language: EN. Choose a language');
  });

  it('comes back up in the remembered language', async () => {
    const storage = new MemoryStorage();
    storage.setItem(LANGUAGE_STORAGE_KEY, 'en');

    const { trigger } = await render('fr', storage);

    expect(trigger().textContent?.trim()).toBe('EN');
  });
});
