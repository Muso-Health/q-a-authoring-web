import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../core/catalog/catalog.model';
import { DialogHost, ModalDialog } from '../../shared/ui/modal-dialog';
import { ConceptEditor } from './concept-editor';

let nextId = 0;

interface Proposal {
  readonly text: string;
  readonly keep: boolean;
}

/** Ask (with an optional context), then review what came back, or say why nothing did. */
type Phase = 'ask' | 'review' | 'failed' | 'empty';

/**
 * A wizard, in a modal, that asks the engine for question variants of a QASet in its language.
 * Generation only proposes: the author unticks the proposals to leave out, and nothing is added
 * to the QASet until they accept. Leaving the dialog any other way adds nothing.
 */
@Component({
  selector: 'app-variant-generator',
  hostDirectives: [DialogHost],
  imports: [TranslocoPipe, ModalDialog],
  template: `
    <app-dialog
      [title]="'authoring.generate.title' | transloco"
      [locked]="editor.busy()"
      (dismissed)="close()"
    >
      <p class="muso-meta lead">
        {{ 'authoring.generate.lead' | transloco: { language: language().name } }}
      </p>
      @switch (phase()) {
        @case ('ask') {
          <form novalidate [attr.aria-busy]="generating()" (submit)="generate($event)">
            <label [for]="id">
              {{ 'authoring.generate.context' | transloco }}
              <span class="optional">{{ 'authoring.generate.optional' | transloco }}</span>
            </label>
            <p class="muso-meta" [id]="id + '-hint'">
              {{ 'authoring.generate.contextHint' | transloco }}
            </p>
            <textarea
              cdkFocusInitial
              rows="3"
              [id]="id"
              [attr.aria-describedby]="id + '-hint'"
              [value]="context()"
              [disabled]="editor.busy()"
              (input)="context.set($any($event.target).value)"
            ></textarea>
            @if (generating()) {
              <p class="generating" role="status">
                <span class="spinner" aria-hidden="true"></span>
                {{ 'authoring.generate.generating' | transloco }}
              </p>
            }
            <div class="actions">
              <button type="submit" [disabled]="editor.busy()">
                {{ 'authoring.generate.submit' | transloco }}
              </button>
              <button type="button" class="secondary" [disabled]="editor.busy()" (click)="close()">
                {{ 'authoring.cancel' | transloco }}
              </button>
            </div>
          </form>
        }
        @case ('review') {
          <form novalidate (submit)="accept($event)">
            <fieldset>
              <legend>{{ 'authoring.generate.candidates' | transloco }}</legend>
              <p class="muso-meta">{{ 'authoring.generate.review' | transloco }}</p>
              <ul class="proposals" [attr.lang]="language().code">
                @for (proposal of proposals(); track $index; let n = $index) {
                  <li [class.discarded]="!proposal.keep">
                    <label>
                      <input
                        #focusTarget
                        type="checkbox"
                        [checked]="proposal.keep"
                        [disabled]="editor.busy()"
                        (change)="toggle(n)"
                      />
                      <span>{{ proposal.text }}</span>
                    </label>
                  </li>
                }
              </ul>
            </fieldset>
            @if (failure(); as message) {
              <p class="field-error" role="alert">{{ message }}</p>
            }
            <div class="actions">
              <button type="submit" [disabled]="editor.busy() || keptCount() === 0">
                {{ 'authoring.generate.accept' | transloco: { count: keptCount() } }}
              </button>
              <button type="button" class="secondary" [disabled]="editor.busy()" (click)="close()">
                {{ 'authoring.generate.discard' | transloco }}
              </button>
            </div>
          </form>
        }
        @default {
          <p class="muso-notice danger" role="alert">
            {{ phase() === 'empty' ? ('authoring.generate.none' | transloco) : failure() }}
          </p>
          <div class="actions">
            <button
              #focusTarget
              type="button"
              class="retry"
              [disabled]="editor.busy()"
              (click)="retry()"
            >
              {{ 'authoring.generate.retry' | transloco }}
            </button>
            <button type="button" class="secondary" [disabled]="editor.busy()" (click)="close()">
              {{ 'authoring.cancel' | transloco }}
            </button>
          </div>
        }
      }
    </app-dialog>
  `,
  styles: `
    .lead {
      margin-block-start: 0;
    }
    form,
    fieldset {
      display: grid;
      gap: var(--muso-space-2);
    }
    fieldset {
      min-inline-size: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }
    legend {
      padding: 0;
      font-weight: 600;
    }
    fieldset > p,
    label + p {
      margin: 0;
    }
    .optional {
      font-weight: 400;
      color: var(--muso-text-muted);
    }
    textarea {
      box-sizing: border-box;
      inline-size: 100%;
    }
    .generating {
      display: flex;
      align-items: center;
      gap: var(--muso-space-2);
      margin: 0;
      font-weight: 600;
    }
    .spinner {
      flex: none;
      inline-size: 1.25rem;
      block-size: 1.25rem;
      border: 3px solid var(--muso-teal-12);
      border-block-start-color: var(--muso-teal);
      border-radius: 50%;
    }
    @media (prefers-reduced-motion: no-preference) {
      .spinner {
        animation: spin 0.8s linear infinite;
      }
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    .proposals {
      display: grid;
      gap: var(--muso-space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .proposals label {
      display: flex;
      align-items: flex-start;
      gap: var(--muso-space-2);
      padding: var(--muso-space-2);
      border: 1px solid var(--muso-border);
      border-radius: var(--muso-radius);
      font-weight: 400;
      cursor: pointer;
    }
    .proposals input {
      flex: none;
      margin-block-start: 0.2em;
    }
    .discarded span {
      color: var(--muso-text-muted);
      text-decoration: line-through;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-2);
    }
    .muso-notice {
      margin-block: 0 var(--muso-space-2);
    }
  `,
})
export class VariantGenerator {
  protected readonly editor = inject(ConceptEditor);
  readonly #injector = inject(Injector);
  protected readonly id = `generator-${nextId++}`;

  readonly qasetId = input.required<string>();
  readonly language = input.required<Language>();
  readonly closed = output();

  protected readonly phase = signal<Phase>('ask');
  protected readonly context = signal('');
  protected readonly proposals = signal<readonly Proposal[]>([]);
  protected readonly keptCount = computed(() => this.proposals().filter((p) => p.keep).length);

  readonly #target = computed(() => `generate:${this.qasetId()}`);
  protected readonly generating = computed(() => this.editor.busy() && this.phase() === 'ask');
  /** A refusal of the QASet itself (gone) is a page alert; inside the modal it is shown here. */
  protected readonly failure = computed(
    () => this.editor.errorFor(this.#target()) ?? this.editor.pageAlert(),
  );
  /** Where focus goes when the phase changes — the first of them — so it never leaves the dialog. */
  private readonly focusTargets = viewChildren<ElementRef<HTMLElement>>('focusTarget');

  protected async generate(event?: Event): Promise<void> {
    event?.preventDefault();
    this.phase.set('ask');
    const candidates = await this.editor.generateVariants(this.qasetId(), this.context().trim());
    if (candidates === null) this.#enter('failed');
    else if (candidates.length === 0) this.#enter('empty');
    else {
      this.proposals.set(candidates.map((text) => ({ text, keep: true })));
      this.#enter('review');
    }
  }

  protected retry(): Promise<void> {
    return this.generate();
  }

  protected toggle(index: number): void {
    this.proposals.update((all) =>
      all.map((proposal, i) => (i === index ? { ...proposal, keep: !proposal.keep } : proposal)),
    );
  }

  protected async accept(event: Event): Promise<void> {
    event.preventDefault();
    const kept = this.proposals()
      .map((proposal, index) => ({ ...proposal, index }))
      .filter((proposal) => proposal.keep);
    const added = new Set<number>();
    const ok = await this.editor.addVariants(
      this.qasetId(),
      kept.map((proposal) => proposal.text),
      (i) => added.add(kept[i].index),
    );
    if (ok) {
      this.close();
      return;
    }
    // What was added is now a variant on the page; only the rest stays to accept again.
    this.proposals.update((all) => all.filter((_, index) => !added.has(index)));
  }

  protected close(): void {
    this.editor.clearError(this.#target());
    this.closed.emit();
  }

  #enter(phase: Phase): void {
    this.phase.set(phase);
    afterNextRender(() => this.focusTargets()[0]?.nativeElement.focus(), {
      injector: this.#injector,
    });
  }
}
