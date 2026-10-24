import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Translator } from '../../../core/i18n/translator';

/** Who last changed a template, and when; the seeded default has no editor. */
@Component({
  selector: 'app-updated-line',
  imports: [TranslocoPipe],
  template: `
    <p class="muso-meta">
      @if (by(); as email) {
        {{ 'admin.prompts.updatedBy' | transloco: { email } }}
      } @else {
        {{ 'admin.prompts.seeded' | transloco }}
      }
      · <time [attr.datetime]="at()">{{ when() }}</time>
    </p>
  `,
  styles: `
    p {
      margin: 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class UpdatedLine {
  readonly #translator = inject(Translator);

  readonly by = input.required<string | null>();
  readonly at = input.required<string>();

  protected readonly when = computed(() =>
    new Intl.DateTimeFormat(this.#translator.language(), {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(this.at())),
  );
}
