import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort, engineError } from '../../core/api/testing/fake-api-port';
import { IDS, world } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { ConceptPage } from './concept-page';

async function render(answers: Record<string, unknown> = world(), language: 'fr' | 'en' = 'fr') {
  TestBed.configureTestingModule({
    imports: [ConceptPage],
    providers: [
      provideTestI18n(language),
      provideRouter([]),
      { provide: ApiPort, useValue: new FakeApiPort(answers) },
    ],
  });
  const fixture = TestBed.createComponent(ConceptPage);
  fixture.componentRef.setInput('conceptId', IDS.concept);
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

describe('ConceptPage', () => {
  it('titles the concept with its first base-language question, under the full breadcrumb', async () => {
    const element = await render();

    expect(text(element.querySelector('.muso-eyebrow'))).toBe('Notion');
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

  it('is a « Concept » in English', async () => {
    const element = await render(world(), 'en');

    expect(text(element.querySelector('.muso-eyebrow'))).toBe('Concept');
    expect(element.textContent).not.toMatch(/\bQ&A set|\bset\b/i);
  });

  it('never speaks of « ensembles »', async () => {
    const element = await render();

    expect(element.textContent).not.toMatch(/ensemble/i);
  });

  it('shows the concept’s intents and categories, for every language', async () => {
    const element = await render();

    const header = element.querySelector('header')!;
    const chips = (kind: string) =>
      [...header.querySelectorAll(`[data-kind="${kind}"] .muso-chips li`)].map((li) => text(li));
    expect(chips('intents')).toEqual(['prévention_paludisme', 'moustiquaire']);
    expect(chips('categories')).toEqual(['Prévention', 'Enfants de moins de 5 ans']);
    expect(section(element, 'fr').querySelector('.muso-chips')).toBeNull();
  });

  it('has one section per QASet, base language first, its content tagged with its language', async () => {
    const element = await render();

    expect(sections(element).map((s) => s.getAttribute('data-lang'))).toEqual(['fr', 'en', 'bm']);
    expect(text(section(element, 'fr').querySelector('h2'))).toContain('Français');
    expect(text(section(element, 'fr').querySelector('h2'))).toContain('Langue de base');
    // The content speaks its language; the UI labels around it stay in the UI's.
    expect(section(element, 'en').querySelector('.answer .text')?.getAttribute('lang')).toBe('en');
    expect(section(element, 'en').getAttribute('lang')).toBeNull();
  });

  it('badges the clinical state on the base QASet and the translation state on the others', async () => {
    const element = await render();
    const badges = (lang: string) =>
      [...section(element, lang).querySelectorAll('.heading .badge')].map((b) => text(b));

    expect(badges('fr')).toEqual(['Validation clinique : validée']);
    expect(badges('en')).toEqual(['Traduction : rejetée']);
    expect(badges('bm')).toEqual(['Traduction : en attente']);
  });

  it('opens each section with the answer and its main question together, the other variants below', async () => {
    const element = await render();
    const fr = section(element, 'fr');
    const blocks = [...fr.children].map((child) => child.className.split(' ')[0]);

    // The pair comes first, right under the language heading, before any count or list.
    expect(blocks.indexOf('lead')).toBe(1);
    expect(blocks.indexOf('lead')).toBeLessThan(blocks.indexOf('counts'));
    expect(blocks.indexOf('lead')).toBeLessThan(blocks.indexOf('variants'));
    const lead = fr.querySelector('.lead')!;
    expect(text(lead.querySelector('.main .text'))).toBe('Comment éviter le paludisme ?');
    expect(text(lead.querySelector('.answer .text'))).toBe(
      'Dormez chaque nuit sous une moustiquaire imprégnée d’insecticide.',
    );
    expect(text(fr.querySelector('.others-heading'))).toBe('Autres variantes');
    expect([...fr.querySelectorAll('ol.variants .variant .text')].map((v) => text(v))).toEqual([
      'Faut-il dormir sous une moustiquaire ?',
      'Que faire contre les moustiques la nuit ?',
    ]);
    // Every variant, the main question first, in creation order.
    expect([...fr.querySelectorAll('.variant .text')].map((v) => text(v))).toEqual([
      'Comment éviter le paludisme ?',
      'Faut-il dormir sous une moustiquaire ?',
      'Que faire contre les moustiques la nuit ?',
    ]);
  });

  it('shows the answer alone at the top when a language has no question yet, and says when there is no other', async () => {
    const element = await render();

    const en = section(element, 'en');
    expect(text(en.querySelector('.lead .main .text'))).toBe('How can I avoid malaria?');
    expect(en.querySelector('ol.variants')).toBeNull();
    expect(text(en)).toContain('Aucune autre variante.');
    const bm = section(element, 'bm');
    expect(bm.querySelector('.lead .main')).toBeNull();
    expect(bm.querySelector('.lead .answer .text')).not.toBeNull();
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

  it('lists each item’s audios per voice, each playable with its quality badge', async () => {
    const element = await render();
    const answer = section(element, 'fr').querySelector('.answer')!;

    const audios = [...answer.querySelectorAll('li.audio')];
    expect(audios.map((li) => text(li.querySelector('.voice')))).toEqual(['Awa', 'Moussa']);
    expect(audios.map((li) => text(li.querySelector('.badge[data-kind="audio"]')))).toEqual([
      'Qualité audio : en attente',
      'Qualité audio : validée',
    ]);
    expect(audios[1].querySelector('app-audio-player button')?.getAttribute('aria-label')).toBe(
      'Écouter la réponse, voix Moussa (1:01)',
    );
    const variants = [...section(element, 'fr').querySelectorAll('.variant')];
    expect(variants.map((v) => text(v.querySelector('li.audio .voice')) ?? null)).toEqual([
      'Awa',
      null,
      'Moussa',
    ]);
    expect(text(variants[1].querySelector('.no-audio'))).toBe('Pas d’audio');
  });

  it('says so when a language has no variant yet', async () => {
    const element = await render();

    expect(text(section(element, 'bm'))).toContain('Aucune variante dans cette langue.');
  });

  it('names its languages from the project’s languages', async () => {
    const element = await render({ ...world(), '/languages': { items: [] } });

    expect(text(section(element, 'bm').querySelector('h2'))).toContain('Bambara');
  });

  it('says the concept does not exist when the engine says so', async () => {
    const element = await render({
      ...world(),
      [`/concepts/${IDS.concept}`]: engineError(404, 'concept_not_found'),
    });

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('introuvable');
  });
});
