import { Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../core/catalog/catalog.model';
import { ConceptEditor } from './concept-editor';
import type { QASetSectionView } from './concept-view';
import { LanguagePair } from './language-pair';
import { VariantTabs } from './variant-tabs';

/** One project language, and its QASet if the notion has one in it yet. */
interface PairRow {
  readonly language: Language;
  readonly section: QASetSectionView | null;
}

/**
 * The notion's one card, titled by its base language: its principal pairs — the base language's
 * first, then every other project language's, aligned — and below, its variants, a tab per language.
 */
@Component({
  selector: 'app-concept-card',
  imports: [TranslocoPipe, LanguagePair, VariantTabs],
  template: `
    @let b = base();
    <section class="concept-card muso-card" aria-labelledby="concept-card-heading">
      <h2 id="concept-card-heading">
        @if (b) {
          {{ b.language.name }} <span class="code">{{ b.language.code }}</span>
          <span class="base">{{ 'concept.baseLanguage' | transloco }}</span>
        } @else {
          {{ 'concept.mainPairs' | transloco }}
        }
      </h2>

      <ul class="pairs" [attr.aria-label]="'concept.mainPairs' | transloco">
        @for (row of rows(); track row.language.id; let first = $first) {
          <li [class.base-pair]="first && !!b" [attr.data-lang]="row.language.code">
            <app-language-pair [language]="row.language" [section]="row.section" />
          </li>
        }
      </ul>

      <h3 class="variants-heading">{{ 'concept.variants' | transloco }}</h3>
      <app-variant-tabs />
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    h2 {
      margin: 0 0 var(--muso-space-2);
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--muso-space-2);
    }
    .code {
      font-family: var(--muso-font-body);
      font-size: var(--muso-caption-size);
      color: var(--muted-fg);
      text-transform: uppercase;
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
    .pairs {
      display: grid;
      gap: 0;
      margin: 0 0 var(--muso-space-4);
      padding: 0;
      list-style: none;
    }
    .pairs > li {
      padding: var(--muso-space-2) var(--muso-space-2);
      border-block-end: 1px solid var(--card-border);
      font-size: 0.9375rem;
    }
    .pairs > li:last-child {
      border-block-end: 0;
    }
    /* The base pair leads: a touch larger, on the brand's accent. */
    .pairs > li.base-pair {
      border-inline-start: 3px solid var(--muso-teal);
      border-radius: var(--muso-radius);
      background: var(--info-bg);
      font-size: var(--muso-body-size, 1rem);
    }
    .variants-heading {
      margin: 0 0 var(--muso-space-1);
      font-size: var(--muso-body-size, 1rem);
    }
  `,
})
export class ConceptCard {
  protected readonly editor = inject(ConceptEditor);

  protected readonly base = computed(
    () => this.editor.view()?.sections.find((section) => section.isBase) ?? null,
  );

  /** The base language first, then every other project language, in the project's order. */
  protected readonly rows = computed<readonly PairRow[]>(() => {
    const sections = this.editor.view()?.sections ?? [];
    const base = this.base();
    const others = this.editor.conceptTargets().map((language) => ({
      language,
      section: sections.find((s) => s.language.id === language.id) ?? null,
    }));
    return base ? [{ language: base.language, section: base }, ...others] : others;
  });
}
