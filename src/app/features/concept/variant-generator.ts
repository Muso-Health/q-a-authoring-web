import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormField, applyEach, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../core/catalog/catalog.model';
import { TextEditor } from '../../shared/ui/text-editor';
import { ConceptEditor } from './concept-editor';

let nextId = 0;

interface Candidate {
  text: string;
  keep: boolean;
}

/**
 * Asks the engine for question variants of a QASet, in its language, then lets the author edit and pick before
 * anything is saved. Candidates live only here: discarded ones are simply dropped.
 */
@Component({
  selector: 'app-variant-generator',
  imports: [FormField, TranslocoPipe, TextEditor],
  template: `
    @if (proposed()) {
      <form class="candidates" novalidate (submit)="addKept($event)">
        <h4>{{ 'authoring.generate.candidates' | transloco }}</h4>
        @if (field.candidates.length === 0) {
          <p class="muso-meta">{{ 'authoring.generate.none' | transloco }}</p>
        }
        <ol>
          @for (candidate of field.candidates; track $index; let n = $index) {
            <li [class.discarded]="!candidate.keep().value()">
              <label class="keep">
                <input type="checkbox" [formField]="candidate.keep" />
                {{ 'authoring.generate.keep' | transloco: { number: n + 1 } }}
              </label>
              <label class="visually-hidden" [for]="id + '-' + n">
                {{ 'authoring.generate.candidate' | transloco: { number: n + 1 } }}
              </label>
              <textarea
                [id]="id + '-' + n"
                rows="2"
                [attr.lang]="language().code"
                [formField]="candidate.text"
                [attr.aria-invalid]="tried() && candidate().invalid() ? 'true' : null"
              ></textarea>
              @if (tried() && candidate().invalid()) {
                <p class="field-error">{{ 'authoring.blank' | transloco }}</p>
              }
            </li>
          }
        </ol>
        @if (editor.errorFor(target()); as message) {
          <p class="field-error" role="alert">{{ message }}</p>
        }
        <div class="actions">
          <button type="submit" [disabled]="editor.busy() || keptCount() === 0">
            {{ 'authoring.generate.addKept' | transloco: { count: keptCount() } }}
          </button>
          <button type="button" class="secondary" (click)="close()">
            {{ 'authoring.generate.discard' | transloco }}
          </button>
        </div>
      </form>
    } @else {
      <app-text-editor
        [label]="'authoring.generate.context' | transloco"
        [required]="false"
        [saveLabel]="'authoring.generate.submit' | transloco"
        [busy]="editor.busy()"
        [error]="editor.errorFor(target())"
        (save)="generate($event)"
        (cancel)="close()"
      />
    }
  `,
  styles: `
    h4 {
      margin: 0;
    }
    ol {
      display: grid;
      gap: var(--muso-space-2);
      margin: 0;
      padding-inline-start: var(--muso-space-4);
    }
    li {
      display: grid;
      gap: var(--muso-space-1);
    }
    .keep {
      display: inline-flex;
      align-items: center;
      gap: var(--muso-space-1);
      font-weight: 400;
    }
    .discarded textarea {
      opacity: 0.6;
    }
  `,
})
export class VariantGenerator {
  protected readonly editor = inject(ConceptEditor);
  protected readonly id = `generator-${nextId++}`;

  readonly qasetId = input.required<string>();
  readonly language = input.required<Language>();
  readonly closed = output();

  protected readonly target = computed(() => `generate:${this.qasetId()}`);
  protected readonly proposed = signal(false);
  protected readonly tried = signal(false);

  readonly #model = signal<{ candidates: Candidate[] }>({ candidates: [] });
  protected readonly field = form(this.#model, (path) => {
    applyEach(path.candidates, (candidate) => {
      validate(candidate, ({ value }) =>
        value().keep && value().text.trim() === '' ? requiredError() : undefined,
      );
    });
  });
  protected readonly keptCount = computed(
    () => this.#model().candidates.filter((c) => c.keep).length,
  );

  protected async generate(context: string): Promise<void> {
    const candidates = await this.editor.generateVariants(this.qasetId(), context);
    if (candidates === null) return;
    this.#model.set({ candidates: candidates.map((text) => ({ text, keep: true })) });
    this.proposed.set(true);
  }

  protected async addKept(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    if (this.field().invalid()) return;

    const kept = this.#model()
      .candidates.map((candidate, index) => ({ ...candidate, index }))
      .filter((candidate) => candidate.keep);
    const added = new Set<number>();
    const ok = await this.editor.addVariants(
      this.qasetId(),
      kept.map((candidate) => candidate.text.trim()),
      (i) => added.add(kept[i].index),
    );
    if (ok) {
      this.close();
      return;
    }
    // What was added is now a variant on the page; only the rest stays to retry.
    this.#model.update(({ candidates }) => ({
      candidates: candidates.filter((_, index) => !added.has(index)),
    }));
  }

  protected close(): void {
    this.editor.clearError(this.target());
    this.closed.emit();
  }
}
