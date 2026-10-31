import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort, engineError } from '../../core/api/testing/fake-api-port';
import { ChartPort, type DonutSpec, type StackedBarSpec } from '../../core/chart/chart-port';
import { FakeChartPort } from '../../core/chart/testing/fake-chart-port';
import { IDS, world } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { EMPTY_STATS, STATS } from '../../core/stats/testing/stats-fixtures';
import { ProjectPage } from './project-page';

const STATS_PATH = `/projects/${IDS.project}/stats`;
const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();
/** Part by part: Angular drops the whitespace between elements, so join the children. */
const parts = (element: Element) => [...element.children].map((child) => text(child)).join(' ');

function setUp(stats: unknown = STATS, language: 'fr' | 'en' = 'fr') {
  const api = new FakeApiPort({ ...world(), [STATS_PATH]: stats });
  const charts = new FakeChartPort();
  TestBed.configureTestingModule({
    imports: [ProjectPage],
    providers: [
      provideTestI18n(language),
      provideRouter([]),
      { provide: ApiPort, useValue: api },
      { provide: ChartPort, useValue: charts },
    ],
  });
  const fixture = TestBed.createComponent(ProjectPage);
  fixture.componentRef.setInput('projectId', IDS.project);
  return { api, charts, fixture, element: fixture.nativeElement as HTMLElement };
}

async function render(stats: unknown = STATS, language: 'fr' | 'en' = 'fr') {
  const page = setUp(stats, language);
  await page.fixture.whenStable();
  const dashboard = () => page.element.querySelector<HTMLElement>('section.dashboard')!;
  const tile = (stat: string) => dashboard().querySelector(`.tiles [data-stat="${stat}"]`);
  const language_ = (code: string) =>
    dashboard().querySelector<HTMLElement>(`.completeness [data-lang="${code}"]`)!;
  return { ...page, dashboard, tile, language: language_ };
}

const bars = (charts: FakeChartPort, label: string) => charts.named(label)?.spec as StackedBarSpec;
const donut = (charts: FakeChartPort, label: string) => charts.named(label)?.spec as DonutSpec;

describe('ProjectPage dashboard', () => {
  it('requests the project’s stats and shows its three counts as tiles', async () => {
    const { api, dashboard, tile } = await render();

    expect(api.reads).toContain(STATS_PATH);
    expect(text(dashboard().querySelector('h2'))).toBe('Tableau de bord');
    expect([...dashboard().querySelectorAll('.tiles > li')].map(parts)).toEqual([
      '2 Protocoles',
      '5 Thèmes',
      '12 Notions',
    ]);
    expect(text(tile('concepts')?.querySelector('.value'))).toBe('12');
  });

  it('charts each language’s completeness, base first, with complete and not-complete counts', async () => {
    const { charts, dashboard } = await render();

    const languages = [...dashboard().querySelectorAll<HTMLElement>('.completeness [data-lang]')];
    expect(languages.map((l) => l.dataset['lang'])).toEqual(['fr', 'en', 'bm']);
    expect(bars(charts, 'Complétude — Français')).toEqual({
      kind: 'stacked-bar',
      label: 'Complétude — Français',
      categories: ['Audio', 'Audio validé', 'Validation clinique'],
      series: [
        { name: 'Complet', tone: 'complete', values: [9, 6, 10] },
        { name: 'Incomplet', tone: 'incomplete', values: [3, 6, 2] },
      ],
    });
    // Outside the base language, validation is the translation's.
    expect(bars(charts, 'Complétude — English')).toEqual({
      kind: 'stacked-bar',
      label: 'Complétude — English',
      categories: ['Audio', 'Audio validé', 'Validation de la traduction'],
      series: [
        { name: 'Complet', tone: 'complete', values: [1, 0, 2] },
        { name: 'Incomplet', tone: 'incomplete', values: [3, 4, 2] },
      ],
    });
  });

  it('states every figure in text too, with the present total: colour is never alone', async () => {
    const { language } = await render();

    const fr = language('fr');
    expect(text(fr.querySelector('h4'))).toContain('Français');
    expect(text(fr.querySelector('h4'))).toContain('Langue de base');
    expect(text(fr.querySelector('.present'))).toBe('Notions présentes : 12');
    const rows = [...fr.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.children].map((cell) => text(cell)),
    );
    expect(rows).toEqual([
      ['Audio', '9 (75 %)', '3 (25 %)'],
      ['Audio validé', '6 (50 %)', '6 (50 %)'],
      ['Validation clinique', '10 (83 %)', '2 (17 %)'],
    ]);
    expect([...fr.querySelectorAll('thead th')].map((th) => text(th))).toEqual([
      'Critère',
      'Complet',
      'Incomplet',
    ]);
  });

  it('says so, rather than drawing an empty chart, for a language with no notion yet', async () => {
    const { charts, language } = await render();

    expect(text(language('bm'))).toContain('Aucune notion dans cette langue pour l’instant.');
    expect(language('bm').querySelector('app-chart')).toBeNull();
    expect(charts.named('Complétude — Bambara')).toBeUndefined();
  });

  it('draws intent and category coverage as two donuts, with and without', async () => {
    const { charts, dashboard } = await render();

    expect(donut(charts, 'Couverture par intention')).toEqual({
      kind: 'donut',
      label: 'Couverture par intention',
      slices: [
        { name: 'Avec intention', tone: 'complete', value: 8 },
        { name: 'Sans intention', tone: 'incomplete', value: 4 },
      ],
    });
    expect(donut(charts, 'Couverture par catégorie')).toEqual({
      kind: 'donut',
      label: 'Couverture par catégorie',
      slices: [
        { name: 'Avec catégorie', tone: 'complete', value: 11 },
        { name: 'Sans catégorie', tone: 'incomplete', value: 1 },
      ],
    });
    const intent = dashboard().querySelector('.coverage [data-kind="intent"]');
    expect([...(intent?.querySelectorAll('dl > div') ?? [])].map(parts)).toEqual([
      'Avec intention 8 (67 %)',
      'Sans intention 4 (33 %)',
    ]);
  });

  it('names each chart for assistive technology', async () => {
    const { charts } = await render();

    for (const chart of charts.charts) {
      expect(chart.host.getAttribute('role')).toBe('img');
      expect(chart.host.getAttribute('aria-label')).toBe(chart.spec.label);
    }
    expect(charts.charts).toHaveLength(4);
  });

  it('shows a loading state while the stats are on their way', async () => {
    let release: (stats: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => (release = resolve));
    const { fixture, element, charts } = setUp(pending);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    const dashboard = element.querySelector('section.dashboard');
    expect(dashboard?.querySelector('app-loading')).not.toBeNull();
    expect(dashboard?.querySelector('.tiles')).toBeNull();
    release(STATS);
    await fixture.whenStable();
    expect(element.querySelector('section.dashboard app-loading')).toBeNull();
    expect(charts.charts).toHaveLength(4);
  });

  it('shows zeros gracefully for a project with no content', async () => {
    const { charts, dashboard, tile } = await render(EMPTY_STATS);

    expect(
      ['protocols', 'themes', 'concepts'].map((s) => text(tile(s)?.querySelector('.value'))),
    ).toEqual(['0', '0', '0']);
    expect(text(dashboard().querySelector('.dashboard-empty'))).toBe(
      'Ce projet n’a encore aucune notion : les graphiques se rempliront au fil de la rédaction.',
    );
    expect(charts.charts).toEqual([]);
    expect(text(dashboard().querySelector('.coverage'))).toContain(
      'Aucune notion à couvrir pour l’instant.',
    );
    expect(text(dashboard())).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('keeps the rest of the page, and offers a retry, when the stats cannot be read', async () => {
    const { element, dashboard } = await render(engineError(503, 'unavailable'));

    expect(text(element.querySelector('h1'))).toContain('Santé communautaire Mali');
    expect(dashboard().querySelector('app-load-error')).not.toBeNull();
    expect(element.querySelector('section a')?.getAttribute('href')).toBe(
      `/protocols/${IDS.protocol}`,
    );
  });

  it('speaks English', async () => {
    const { charts, dashboard } = await render(STATS, 'en');

    expect(text(dashboard().querySelector('h2'))).toBe('Dashboard');
    expect([...dashboard().querySelectorAll('.tiles > li')].map(parts)).toEqual([
      '2 Protocols',
      '5 Themes',
      '12 Concepts',
    ]);
    expect(bars(charts, 'Completeness — English').categories).toEqual([
      'Audio',
      'Validated audio',
      'Translation validation',
    ]);
    expect(donut(charts, 'Coverage by intent').slices.map((s) => s.name)).toEqual([
      'With an intent',
      'Without an intent',
    ]);
  });
});
