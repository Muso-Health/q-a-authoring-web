import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AudioPlayer } from '../audio/audio-player';
import type { AudioItem, ClinicalItem, TranslationItem } from './queue-item';

/** A card's headings label its parts; they must not outrank the page's own. */
const CARD_STYLES = `
  h3 {
    font-size: var(--muso-body-lg-size);
    margin-block: 0 var(--muso-space-1);
  }
  p {
    margin-block: 0 var(--muso-space-1);
  }
`;

/** Clinical: the base-language answer and its variants, decided as one QASet. */
@Component({
  selector: 'app-clinical-card',
  imports: [TranslocoPipe],
  template: `
    @let it = item();
    <section class="answer">
      <h3>{{ 'validation.card.answer' | transloco: { language: languageName() } }}</h3>
      <p class="muso-lead" [attr.lang]="it.languageCode">{{ it.answerText }}</p>
    </section>
    <section>
      <h3>{{ 'validation.card.variants' | transloco }}</h3>
      @if (it.variantTexts.length === 0) {
        <p class="muso-meta">{{ 'validation.card.noVariants' | transloco }}</p>
      } @else {
        <ol class="variants">
          @for (variant of it.variantTexts; track $index) {
            <li [attr.lang]="it.languageCode">{{ variant }}</li>
          }
        </ol>
      }
    </section>
  `,
  styles: CARD_STYLES,
})
export class ClinicalCard {
  readonly item = input.required<ClinicalItem>();
  readonly languageName = input.required<string>();
}

/** Translation: the translated text beside what it translates, to compare at a glance. */
@Component({
  selector: 'app-translation-card',
  imports: [TranslocoPipe],
  template: `
    @let it = item();
    <div class="compare">
      <section class="translated">
        <h3>
          {{
            (it.itemKind === 'answer'
              ? 'validation.card.translatedAnswer'
              : 'validation.card.translatedVariant'
            ) | transloco: { language: languageName() }
          }}
        </h3>
        <p class="muso-lead" [attr.lang]="it.languageCode">{{ it.text }}</p>
      </section>
      <section class="source">
        @if (it.sources.length > 0) {
          <h3>{{ 'validation.card.source' | transloco }}</h3>
          @for (source of it.sources; track $index) {
            <p class="muso-lead">{{ source }}</p>
          }
        } @else if (it.fallbackBaseAnswer) {
          <h3>{{ 'validation.card.fallback' | transloco }}</h3>
          <p class="muso-lead">{{ it.fallbackBaseAnswer }}</p>
        } @else {
          <p class="muso-meta">{{ 'validation.card.noSource' | transloco }}</p>
        }
      </section>
    </div>
  `,
  styles: [
    CARD_STYLES,
    `
      .compare {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
        gap: var(--muso-space-3);
      }
      section {
        padding: var(--muso-space-2);
        border-radius: var(--muso-radius);
      }
      .translated {
        background: var(--info-bg);
      }
      .source {
        background: var(--surface-alt);
      }
    `,
  ],
})
export class TranslationCard {
  readonly item = input.required<TranslationItem>();
  readonly languageName = input.required<string>();
}

/** Audio: the recording beside the text it voices. */
@Component({
  selector: 'app-audio-card',
  imports: [TranslocoPipe, AudioPlayer],
  template: `
    @let it = item();
    <section class="voiced">
      <h3>
        {{
          (it.itemKind === 'answer'
            ? 'validation.card.voicedAnswer'
            : 'validation.card.voicedVariant'
          ) | transloco: { language: languageName() }
        }}
      </h3>
      <p class="muso-lead" [attr.lang]="it.languageCode">{{ it.text }}</p>
      <app-audio-player
        [audio]="{ id: it.audioId }"
        [label]="'validation.card.recording' | transloco"
      />
    </section>
  `,
  styles: CARD_STYLES,
})
export class AudioCard {
  readonly item = input.required<AudioItem>();
  readonly languageName = input.required<string>();
}
