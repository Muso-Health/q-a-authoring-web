import { Component, computed, inject, input, resource } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { DonutSpec, StackedBarSpec } from '../../core/chart/chart-port';
import { Translator } from '../../core/i18n/translator';
import {
  ProjectStatsApi,
  type Completion,
  type Coverage,
  type LanguageStats,
} from '../../core/stats/project-stats-api';
import { Chart } from '../../shared/ui/chart';
import { LoadError, Loading } from '../../shared/ui/load-state';

/** One metric of a language, in text: the chart's figures, for whoever cannot see the chart. */
interface MetricRow {
  readonly label: string;
  readonly complete: string;
  readonly notComplete: string;
}

interface LanguageBlock {
  readonly language: LanguageStats;
  readonly chart: StackedBarSpec | null;
  readonly rows: readonly MetricRow[];
}

interface CoverageBlock {
  readonly kind: 'intent' | 'category';
  readonly title: string;
  readonly chart: DonutSpec | null;
  readonly with: { readonly label: string; readonly figure: string };
  readonly without: { readonly label: string; readonly figure: string };
}

const share = (count: number, total: number) =>
  `${count} (${total === 0 ? 0 : Math.round((count / total) * 100)} %)`;

/**
 * A project's dashboard: its counts as tiles, each language's completeness — audio, validated
 * audio, validation — as 100 %-stacked bars, and how many concepts carry an intent and a
 * category, as two donuts. Every figure a chart shows is also stated in text beside it.
 */
@Component({
  selector: 'app-project-dashboard',
  imports: [TranslocoPipe, Chart, Loading, LoadError],
  template: `
    <section class="dashboard" aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading">{{ 'dashboard.heading' | transloco }}</h2>
      @if (stats.hasValue()) {
        @let s = stats.value();
        <ul class="tiles">
          @for (tile of tiles(); track tile.stat) {
            <li class="tile" [attr.data-stat]="tile.stat">
              <span class="value">{{ tile.value }}</span>
              <span class="label">{{ tile.label | transloco }}</span>
            </li>
          }
        </ul>
        @if (s.counts.concepts === 0) {
          <p class="muso-notice dashboard-empty">{{ 'dashboard.empty' | transloco }}</p>
        }

        <section class="completeness" aria-labelledby="completeness-heading">
          <h3 id="completeness-heading">{{ 'dashboard.completeness.heading' | transloco }}</h3>
          <p class="muso-meta">{{ 'dashboard.completeness.lead' | transloco }}</p>
          <div class="languages">
            @for (block of languages(); track block.language.id) {
              @let l = block.language;
              <article class="muso-card language" [attr.data-lang]="l.code">
                <h4>
                  {{ l.name }}
                  @if (l.isBase) {
                    <span class="base">{{ 'concept.baseLanguage' | transloco }}</span>
                  }
                </h4>
                <p class="present">
                  {{ 'dashboard.completeness.present' | transloco: { count: l.present } }}
                </p>
                @if (block.chart; as chart) {
                  <app-chart class="bars" [spec]="chart" />
                  <table class="figures">
                    <caption class="visually-hidden">
                      {{
                        chart.label
                      }}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'dashboard.completeness.metric' | transloco }}</th>
                        <th scope="col">{{ 'dashboard.complete' | transloco }}</th>
                        <th scope="col">{{ 'dashboard.notComplete' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of block.rows; track row.label) {
                        <tr>
                          <th scope="row">{{ row.label }}</th>
                          <td>{{ row.complete }}</td>
                          <td>{{ row.notComplete }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <p class="muso-empty">{{ 'dashboard.completeness.empty' | transloco }}</p>
                }
              </article>
            }
          </div>
        </section>

        <section class="coverage" aria-labelledby="coverage-heading">
          <h3 id="coverage-heading">{{ 'dashboard.coverage.heading' | transloco }}</h3>
          <div class="donuts">
            @for (block of coverage(); track block.kind) {
              <article class="muso-card" [attr.data-kind]="block.kind">
                <h4>{{ block.title }}</h4>
                @if (block.chart; as chart) {
                  <app-chart class="donut" [spec]="chart" />
                  <dl>
                    <div class="with">
                      <dt>{{ block.with.label }}</dt>
                      <dd>{{ block.with.figure }}</dd>
                    </div>
                    <div class="without">
                      <dt>{{ block.without.label }}</dt>
                      <dd>{{ block.without.figure }}</dd>
                    </div>
                  </dl>
                } @else {
                  <p class="muso-empty">{{ 'dashboard.coverage.empty' | transloco }}</p>
                }
              </article>
            }
          </div>
        </section>
      } @else if (stats.error()) {
        <app-load-error [error]="stats.error()" (retry)="stats.reload()" />
      } @else {
        <app-loading />
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-block: var(--muso-space-4);
    }
    h3 {
      margin-block: var(--muso-space-4) var(--muso-space-1);
    }
    h4 {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--muso-space-2);
      font-size: var(--muso-body-lg-size);
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
      gap: var(--muso-space-2);
      margin: var(--muso-space-2) 0;
      padding: 0;
      list-style: none;
    }
    .tile {
      display: grid;
      gap: 0.125rem;
      padding: var(--muso-space-2) var(--muso-space-3);
      border-inline-start: 4px solid var(--muso-teal);
      border-radius: var(--muso-radius);
      background: var(--surface);
      box-shadow: 0 0 0 1px var(--card-border);
    }
    .tile[data-stat='themes'] {
      border-inline-start-color: var(--muso-navy);
    }
    .tile[data-stat='concepts'] {
      border-inline-start-color: var(--muso-orange);
    }
    .value {
      font-size: var(--muso-h2-size, 1.75rem);
      font-weight: 700;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .label {
      font-size: var(--muso-caption-size);
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted-fg);
    }
    .languages,
    .donuts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
      gap: var(--muso-space-3);
    }
    .donuts {
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
    }
    .muso-card {
      min-inline-size: 0;
    }
    .base {
      font-family: var(--muso-font-body);
      padding: 0.1rem var(--muso-space-1);
      border-radius: var(--muso-radius);
      background: var(--muso-navy);
      color: var(--muso-text-inverse);
      font-size: var(--muso-caption-size);
      font-weight: 600;
    }
    .present {
      margin: var(--muso-space-1) 0 var(--muso-space-2);
      color: var(--muted-fg);
    }
    .bars {
      --chart-height: 11rem;
    }
    .donut {
      --chart-height: 13rem;
    }
    .figures {
      inline-size: 100%;
      margin-block-start: var(--muso-space-2);
      font-size: var(--muso-caption-size);
      font-variant-numeric: tabular-nums;
    }
    .figures th[scope='row'] {
      font-weight: 600;
      text-align: start;
    }
    .figures td,
    .figures thead th:not(:first-child) {
      text-align: end;
    }
    dl {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--muso-space-1) var(--muso-space-3);
      margin: var(--muso-space-2) 0 0;
      font-variant-numeric: tabular-nums;
    }
    dl > div {
      display: flex;
      gap: var(--muso-space-1);
    }
    dt {
      color: var(--muted-fg);
    }
    dd {
      margin: 0;
      font-weight: 600;
    }
  `,
})
export class ProjectDashboard {
  readonly #api = inject(ProjectStatsApi);
  readonly #t = inject(Translator);

  readonly projectId = input.required<string>();

  protected readonly stats = resource({
    params: () => this.projectId(),
    loader: ({ params: id }) => this.#api.of(id),
  });

  protected readonly tiles = computed(() => {
    const counts = this.stats.hasValue() ? this.stats.value().counts : null;
    return (['protocols', 'themes', 'concepts'] as const).map((stat) => ({
      stat,
      value: counts?.[stat] ?? 0,
      label: `dashboard.counts.${stat}`,
    }));
  });

  protected readonly languages = computed<readonly LanguageBlock[]>(() =>
    (this.stats.hasValue() ? this.stats.value().languages : []).map((language) =>
      this.#languageBlock(language),
    ),
  );

  protected readonly coverage = computed<readonly CoverageBlock[]>(() => {
    if (!this.stats.hasValue()) return [];
    const { intent, category } = this.stats.value().coverage;
    return [this.#coverageBlock('intent', intent), this.#coverageBlock('category', category)];
  });

  #languageBlock(language: LanguageStats): LanguageBlock {
    const metrics: [string, Completion][] = [
      [this.#t.t('dashboard.metric.audio'), language.audio],
      [this.#t.t('dashboard.metric.validatedAudio'), language.validatedAudio],
      [
        this.#t.t(language.isBase ? 'dashboard.metric.clinical' : 'dashboard.metric.translation'),
        language.validation,
      ],
    ];
    if (language.present === 0) return { language, chart: null, rows: [] };
    const total = language.present;
    return {
      language,
      chart: {
        kind: 'stacked-bar',
        label: this.#t.t('dashboard.completeness.chart', { language: language.name }),
        categories: metrics.map(([label]) => label),
        series: [
          {
            name: this.#t.t('dashboard.complete'),
            tone: 'complete',
            values: metrics.map(([, c]) => c.complete),
          },
          {
            name: this.#t.t('dashboard.notComplete'),
            tone: 'incomplete',
            values: metrics.map(([, c]) => c.notComplete),
          },
        ],
      },
      rows: metrics.map(([label, c]) => ({
        label,
        complete: share(c.complete, total),
        notComplete: share(c.notComplete, total),
      })),
    };
  }

  #coverageBlock(kind: 'intent' | 'category', coverage: Coverage): CoverageBlock {
    const total = coverage.with + coverage.without;
    const withLabel = this.#t.t(`dashboard.coverage.${kind}.with`);
    const withoutLabel = this.#t.t(`dashboard.coverage.${kind}.without`);
    const label = this.#t.t(`dashboard.coverage.${kind}.chart`);
    return {
      kind,
      title: this.#t.t(`dashboard.coverage.${kind}.title`),
      chart:
        total === 0
          ? null
          : {
              kind: 'donut',
              label,
              slices: [
                { name: withLabel, tone: 'complete', value: coverage.with },
                { name: withoutLabel, tone: 'incomplete', value: coverage.without },
              ],
            },
      with: { label: withLabel, figure: share(coverage.with, total) },
      without: { label: withoutLabel, figure: share(coverage.without, total) },
    };
  }
}
