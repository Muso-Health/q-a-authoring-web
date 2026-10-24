import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PromptTemplatesApi } from '../../../core/admin/prompt-templates-api';
import { LoadError, Loading } from '../../../shared/ui/load-state';
import { TextEditor } from '../../../shared/ui/text-editor';
import { AdminWrites, reread } from '../admin-writes';
import { UpdatedLine } from './updated-line';

const SAVE = 'save';
const braced = (name: string) => `{${name}}`;

/**
 * One template, edited in place. The engine is the judge of the placeholders: a refusal lists
 * what is missing and what it does not know, next to the draft, which is kept.
 */
@Component({
  selector: 'app-prompt-template-page',
  imports: [RouterLink, TranslocoPipe, Loading, LoadError, TextEditor, UpdatedLine],
  providers: [AdminWrites],
  template: `
    <p>
      <a routerLink="/admin/prompts">← {{ 'admin.prompts.back' | transloco }}</a>
    </p>
    @if (template.hasValue()) {
      @let it = template.value();
      <h2>{{ it.key }}</h2>
      <app-updated-line [by]="it.updatedBy" [at]="it.updatedAt" />

      <section class="guidance muso-notice" aria-labelledby="placeholders-heading">
        <h3 id="placeholders-heading">{{ 'admin.prompts.placeholders' | transloco }}</h3>
        <p>{{ 'admin.prompts.placeholdersHelp' | transloco }}</p>
        <ul class="placeholders muso-chips">
          @for (name of placeholders(); track name) {
            <li>
              <code>{{ name }}</code>
            </li>
          }
        </ul>
        <p class="muso-meta">{{ 'admin.prompts.bracesHelp' | transloco }}</p>
      </section>

      <app-text-editor
        [label]="'admin.prompts.content' | transloco"
        [initial]="it.content"
        [rows]="12"
        [busy]="writes.busy()"
        [error]="writes.errorFor(target)"
        (save)="save($event)"
        (cancel)="back()"
      />
      @if (problems(); as found) {
        <div class="problems">
          @if (found.missing.length > 0) {
            <p class="missing">
              {{ 'admin.prompts.missing' | transloco }} <code>{{ found.missing.join(', ') }}</code>
            </p>
          }
          @if (found.unknown.length > 0) {
            <p class="unknown">
              {{ 'admin.prompts.unknown' | transloco }} <code>{{ found.unknown.join(', ') }}</code>
            </p>
          }
        </div>
      }
      <div aria-live="polite">
        @if (saved()) {
          <p role="status" class="saved">{{ 'admin.prompts.saved' | transloco }}</p>
        }
      </div>
    } @else if (template.error()) {
      <app-load-error [error]="template.error()" (retry)="template.reload()" />
    } @else {
      <app-loading />
    }
  `,
  styles: `
    h2 {
      overflow-wrap: anywhere;
    }
    .guidance {
      margin-block: var(--muso-space-3);
      max-inline-size: 48rem;
    }
    .guidance h3 {
      margin-block: 0 var(--muso-space-1);
      font-size: var(--muso-body-lg-size);
    }
    .guidance .muso-chips {
      margin-block-end: var(--muso-space-1);
    }
    .problems {
      margin-block-start: var(--muso-space-1);
      color: var(--danger-fg);
    }
    .problems p {
      margin: 0;
    }
    .saved {
      margin-block-start: var(--muso-space-1);
      font-weight: 600;
    }
  `,
})
export class PromptTemplatePage {
  readonly #api = inject(PromptTemplatesApi);
  readonly #router = inject(Router);
  protected readonly writes = inject(AdminWrites);
  protected readonly target = SAVE;

  readonly key = input.required<string>();

  protected readonly template = resource({
    params: () => this.key(),
    loader: ({ params: key }) => this.#api.get(key),
  });
  protected readonly placeholders = computed(() =>
    this.template.hasValue() ? this.template.value().requiredPlaceholders.map(braced) : [],
  );
  protected readonly problems = computed(() => {
    const found = this.writes.problemsFor(SAVE);
    return found && { missing: found.missing.map(braced), unknown: found.unknown.map(braced) };
  });
  protected readonly saved = signal(false);

  protected async save(content: string): Promise<void> {
    this.saved.set(false);
    const key = this.key();
    const ok = await this.writes.run(
      SAVE,
      () => this.#api.update(key, content),
      () => reread(this.template, () => this.#api.get(key)),
    );
    this.saved.set(ok);
  }

  protected back(): void {
    void this.#router.navigate(['/admin/prompts']);
  }
}
