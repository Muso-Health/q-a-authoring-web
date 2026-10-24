import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort, engineError } from '../../core/api/testing/fake-api-port';
import { IDS, world } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { QASetPage } from './qaset-page';

async function render(answers: Record<string, unknown> = world()) {
  TestBed.configureTestingModule({
    imports: [QASetPage],
    providers: [
      provideTestI18n(),
      provideRouter([]),
      { provide: ApiPort, useValue: new FakeApiPort(answers) },
    ],
  });
  const fixture = TestBed.createComponent(QASetPage);
  fixture.componentRef.setInput('qasetId', IDS.qaset);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const sections = (element: HTMLElement) => [
  ...element.querySelectorAll<HTMLElement>('section.language'),
];
const section = (element: HTMLElement, lang: string) =>
  element.querySelector<HTMLElement>(`section.language[data-lang="${lang}"]`)!;
const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim();
/** Cell by cell: Angular drops the whitespace between elements, so join the children. */
const cells = (element: Element) => [...element.children].map((child) => text(child)).join(' ');

describe('QASetPage', () => {
  it('titles the set with its first base-language question, under the full breadcrumb', async () => {
    const element = await render();

    expect(text(element.querySelector('h1'))).toBe('Comment éviter le paludisme ?');
    const crumbs = element.querySelectorAll('nav[aria-label="Fil d’Ariane"] li');
    expect([...crumbs].map((li) => text(li))).toEqual([
      'Projets',
      'Santé communautaire Mali',
      'Paludisme',
      'Prévention',
      'Comment éviter le paludisme ?',
    ]);
  });

  it('shows the clinical state and the categories at the set level', async () => {
    const element = await render();

    const header = element.querySelector('header')!;
    expect(text(header.querySelector('.badge'))).toBe('Validation clinique : validée');
    expect([...header.querySelectorAll('.muso-chips li')].map((li) => text(li))).toEqual([
      'Prévention',
      'Enfants de moins de 5 ans',
    ]);
  });

  it('groups by language, base language first, each named, its content tagged with its language', async () => {
    const element = await render();

    expect(sections(element).map((s) => s.getAttribute('data-lang'))).toEqual(['fr', 'en', 'bm']);
    expect(text(section(element, 'fr').querySelector('h2'))).toContain('Français');
    expect(text(section(element, 'fr').querySelector('h2'))).toContain('Langue de base');
    // The content speaks its language; the UI labels around it stay in the UI's.
    expect(section(element, 'en').querySelector('.answer .text')?.getAttribute('lang')).toBe('en');
    expect(section(element, 'en').getAttribute('lang')).toBeNull();
  });

  it('renders the answer, then the variants in creation order', async () => {
    const element = await render();
    const fr = section(element, 'fr');

    expect(text(fr.querySelector('.answer .text'))).toBe(
      'Dormez chaque nuit sous une moustiquaire imprégnée d’insecticide.',
    );
    expect([...fr.querySelectorAll('.variant .text')].map((v) => text(v))).toEqual([
      'Comment éviter le paludisme ?',
      'Faut-il dormir sous une moustiquaire ?',
      'Que faire contre les moustiques la nuit ?',
    ]);
  });

  it('counts variants and variants with audio per language, as distinct figures', async () => {
    const element = await render();
    const counts = (lang: string) =>
      [...section(element, lang).querySelectorAll('.counts > div')].map(cells);

    expect(counts('fr')).toEqual(['Variantes 3', 'Variantes avec audio 2 / 3']);
    expect(counts('en')).toEqual(['Variantes 1', 'Variantes avec audio 0 / 1']);
    expect(counts('bm')).toEqual(['Variantes 0', 'Variantes avec audio 0 / 0']);
  });

  it('summarises coverage per language in one table, text and audio in separate columns', async () => {
    const element = await render();

    const table = element.querySelector('table')!;
    expect([...table.querySelectorAll('thead th')].map((th) => text(th))).toEqual([
      'Langue',
      'Variantes',
      'Variantes avec audio',
      'Audio de la réponse',
    ]);
    expect([...table.querySelectorAll('tbody tr')].map(cells)).toEqual([
      'Français 3 2 Oui',
      'English 1 0 Non',
      'Bambara 0 0 Oui',
    ]);
  });

  it('shows each variant’s intents as chips', async () => {
    const element = await render();
    const [first, second, third] = section(element, 'fr').querySelectorAll('.variant');

    expect([...first.querySelectorAll('.muso-chips li')].map((li) => text(li))).toEqual([
      'prévention_paludisme',
      'moustiquaire',
    ]);
    expect(second.querySelectorAll('.muso-chips li')).toHaveLength(1);
    expect(third.querySelector('.muso-chips')).toBeNull();
  });

  it('links each translation to its counterpart, naming its language', async () => {
    const element = await render();

    const link = section(element, 'fr').querySelector<HTMLAnchorElement>('.variant .links a')!;
    expect(text(link)).toBe('English');
    expect(link.getAttribute('href')).toBe(`/#item-${IDS.variantEn1}`);
    expect(element.querySelector(`#item-${IDS.variantEn1}`)).not.toBeNull();
    expect(text(section(element, 'en').querySelector('.answer .links a'))).toBe('Français');
  });

  it('badges translation state on translated items only', async () => {
    const element = await render();
    const translationBadges = (lang: string) =>
      [...section(element, lang).querySelectorAll('.badge[data-kind="translation"]')].map((b) =>
        text(b),
      );

    expect(translationBadges('fr')).toEqual([]);
    expect(translationBadges('en')).toEqual(['Traduction : validée', 'Traduction : rejetée']);
    expect(translationBadges('bm')).toEqual(['Traduction : en attente']);
  });

  it('offers playback and an audio-quality badge on each audio, and nothing without one', async () => {
    const element = await render();
    const fr = section(element, 'fr');

    expect(fr.querySelector('.answer app-audio-player')).not.toBeNull();
    expect(text(fr.querySelector('.answer .badge[data-kind="audio"]'))).toBe(
      'Qualité audio : en attente',
    );
    const variants = [...fr.querySelectorAll('.variant')];
    expect(variants.map((v) => text(v.querySelector('.badge[data-kind="audio"]')) ?? null)).toEqual(
      ['Qualité audio : validée', null, 'Qualité audio : rejetée'],
    );
    expect(variants[1].querySelector('app-audio-player')).toBeNull();
    expect(text(variants[1].querySelector('.no-audio'))).toBe('Pas d’audio');
  });

  it('says so when a language has no variant yet', async () => {
    const element = await render();

    expect(text(section(element, 'bm'))).toContain('Aucune variante dans cette langue.');
  });

  it('says the set does not exist when the engine says so', async () => {
    const element = await render({
      ...world(),
      [`/qasets/${IDS.qaset}`]: engineError(404, 'qaset_not_found'),
    });

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('introuvable');
  });
});
