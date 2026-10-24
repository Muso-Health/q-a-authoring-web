import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ItemMeta } from './item-meta';
import type { LanguageSectionView } from './qaset-view';

/** One language of a QASet: its counts, its answer, then its variants in creation order. */
@Component({
  selector: 'app-language-section',
  imports: [TranslocoPipe, ItemMeta],
  template: `
    @let s = section();
    <section
      class="language muso-card"
      [attr.data-lang]="s.language.code"
      [attr.aria-labelledby]="'language-' + s.language.id"
    >
      <h2 [id]="'language-' + s.language.id">
        {{ s.language.name }} <span class="code">{{ s.language.code }}</span>
        @if (s.isBase) {
          <span class="base">{{ 'qaset.baseLanguage' | transloco }}</span>
        }
      </h2>

      <dl class="counts">
        <div class="text-coverage">
          <dt>{{ 'qaset.counts.variants' | transloco }}</dt>
          <dd>{{ s.counts.variants }}</dd>
        </div>
        <div class="audio-coverage">
          <dt>{{ 'qaset.counts.withAudio' | transloco }}</dt>
          <dd>{{ s.counts.variantsWithAudio }} / {{ s.counts.variants }}</dd>
        </div>
      </dl>

      <article class="answer" [id]="'item-' + s.answer.id" tabindex="-1">
        <h3>{{ 'qaset.answer' | transloco }}</h3>
        <p class="text" [attr.lang]="s.language.code">{{ s.answer.text }}</p>
        <app-item-meta [item]="s.answer" [label]="'qaset.answerAudio' | transloco" />
      </article>

      <h3>{{ 'qaset.variants' | transloco }}</h3>
      @if (s.variants.length === 0) {
        <p class="muso-empty">{{ 'qaset.noVariants' | transloco }}</p>
      } @else {
        <ol class="variants">
          @for (variant of s.variants; track variant.id; let n = $index) {
            <li class="variant" [id]="'item-' + variant.id" tabindex="-1">
              <p class="text" [attr.lang]="s.language.code">{{ variant.text }}</p>
              @if (variant.intents.length > 0) {
                <ul class="muso-chips" [attr.aria-label]="'qaset.intents' | transloco">
                  @for (intent of variant.intents; track intent.id) {
                    <li>{{ intent.text }}</li>
                  }
                </ul>
              }
              <app-item-meta
                [item]="variant"
                [label]="'qaset.variantAudio' | transloco: { number: n + 1 }"
              />
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: `
    h2 {
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
    h3 {
      font-size: var(--muso-body-lg-size);
      margin-block-end: var(--muso-space-1);
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
    .counts {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-2);
      margin: var(--muso-space-2) 0 var(--muso-space-3);
    }
    .counts > div {
      padding: var(--muso-space-1) var(--muso-space-2);
      border-inline-start: 4px solid var(--muso-navy);
      background: var(--surface-alt);
    }
    .counts > .audio-coverage {
      border-inline-start-color: var(--muso-teal);
    }
    dt {
      font-size: var(--muso-caption-size);
      color: var(--muted-fg);
    }
    dd {
      margin: 0;
      font-size: var(--muso-h3-size);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .answer {
      padding: var(--muso-space-2);
      border-radius: var(--muso-radius);
      background: var(--info-bg);
      margin-block-end: var(--muso-space-3);
    }
    .text {
      margin: 0;
      font-size: var(--muso-body-lg-size);
    }
    .variants {
      display: grid;
      gap: var(--muso-space-2);
      margin: 0;
      padding-inline-start: var(--muso-space-4);
    }
    .variant {
      padding-block: var(--muso-space-1);
      border-block-end: 1px solid var(--card-border);
    }
    .variant .muso-chips {
      margin-block: var(--muso-space-1) 0;
    }
  `,
})
export class LanguageSection {
  readonly section = input.required<LanguageSectionView>();
}
