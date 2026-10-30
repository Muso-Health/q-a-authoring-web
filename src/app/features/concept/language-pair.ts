import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../core/catalog/catalog.model';
import { Translator } from '../../core/i18n/translator';
import { FocusReturn } from '../../shared/ui/focus-return';
import { ModalDialog } from '../../shared/ui/modal-dialog';
import { TextEditor } from '../../shared/ui/text-editor';
import { Toolbar, type ToolbarAction } from '../../shared/ui/toolbar';
import { AudioDialog } from './audio-dialog';
import { ConceptEditor } from './concept-editor';
import type { QASetSectionView } from './concept-view';
import { ItemAudios } from './item-audios';
import { Untranslated } from './untranslated';
import { VariantItem } from './variant-item';

/**
 * One language's principal pair: its main question, with its tools on the same line, and its
 * answer right below, muted, with its own (edit, manage audio). Without a question yet, the soft
 * « not translated yet » chip takes the question's place.
 */
@Component({
  selector: 'app-language-pair',
  imports: [
    TranslocoPipe,
    AudioDialog,
    ItemAudios,
    ModalDialog,
    TextEditor,
    Toolbar,
    Untranslated,
    VariantItem,
  ],
  template: `
    @let l = language();
    @let s = section();
    <span class="language">{{ l.name }}</span>
    <div class="pair">
      @if (s && s.variants[0]; as main) {
        <app-variant-item
          context="pair"
          class="question"
          [qasetId]="s.id"
          [language]="l"
          [variant]="main"
          [number]="1"
        />
      } @else {
        <app-untranslated place="pair" [language]="l" />
      }
      @if (s) {
        <div class="answer">
          <div class="line">
            <p class="text" [attr.lang]="l.code">{{ s.answer.text }}</p>
            @if (answerTools().length > 0) {
              <app-toolbar [label]="labels().toolbar" [actions]="answerTools()" />
            }
          </div>
          <app-item-audios
            role="answer"
            [qasetId]="s.id"
            [item]="s.answer"
            [label]="'concept.answerAudio' | transloco"
          />
        </div>

        @if (editing()) {
          <app-dialog
            [title]="'authoring.editAnswerTitle' | transloco: { language: l.name }"
            [locked]="editor.busy()"
            (dismissed)="closeEdit()"
          >
            <app-text-editor
              [label]="'authoring.answerLabel' | transloco: { language: l.name }"
              [initial]="s.answer.text"
              [lang]="l.code"
              [rows]="5"
              [busy]="editor.busy()"
              [error]="editor.errorFor('answer:' + s.id)"
              (save)="save(s.id, $event)"
              (cancel)="closeEdit()"
            />
          </app-dialog>
        }
        @if (audio()) {
          <app-audio-dialog
            role="answer"
            [qasetId]="s.id"
            [item]="s.answer"
            [language]="l"
            [label]="'concept.answerAudio' | transloco"
            (closed)="closeAudio()"
          />
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 6rem minmax(0, 1fr);
      align-items: start;
      gap: var(--muso-space-1) var(--muso-space-2);
    }
    .language {
      font-size: var(--muso-caption-size);
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted-fg);
      padding-block-start: 0.6rem;
      overflow-wrap: anywhere;
    }
    .pair {
      display: grid;
      gap: var(--muso-space-1);
      min-inline-size: 0;
    }
    .question {
      font-weight: 600;
    }
    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1) var(--muso-space-2);
    }
    .answer .text {
      flex: 1 1 12rem;
      min-inline-size: 0;
      margin: 0;
      color: var(--muso-text-muted);
      overflow-wrap: anywhere;
    }
    @media (max-width: 30rem) {
      :host {
        grid-template-columns: minmax(0, 1fr);
      }
      .language {
        padding-block-start: 0;
      }
    }
  `,
})
export class LanguagePair {
  protected readonly editor = inject(ConceptEditor);
  readonly #focus = inject(FocusReturn);
  readonly #t = inject(Translator);

  readonly language = input.required<Language>();
  /** Its QASet, if the notion has one in that language yet. */
  readonly section = input.required<QASetSectionView | null>();

  protected readonly editing = signal(false);
  protected readonly audio = signal(false);

  /** Every answer shows in the one card: each tool is named by its language. */
  protected readonly labels = computed(() => {
    const language = this.language().name;
    return {
      toolbar: this.#t.t('tools.pairAnswer.toolbar', { language }),
      edit: this.#t.t('tools.pairAnswer.edit', { language }),
      audio: this.#t.t('tools.pairAnswer.audio', { language }),
    };
  });

  protected readonly answerTools = computed<readonly ToolbarAction[]>(() => {
    const l = this.labels();
    const id = this.language().id;
    const busy = this.editor.busy();
    return [
      ...(this.editor.canAuthor()
        ? [
            {
              id: `edit-answer:${id}`,
              icon: 'edit' as const,
              label: l.edit,
              disabled: busy,
              handler: () => this.editing.set(true),
            },
          ]
        : []),
      ...(this.editor.canManageAudio()
        ? [
            {
              id: `answer-audio:${id}`,
              icon: 'audio' as const,
              label: l.audio,
              disabled: busy,
              handler: () => this.audio.set(true),
            },
          ]
        : []),
    ];
  });

  protected async save(qasetId: string, text: string): Promise<void> {
    if (await this.editor.editAnswer(qasetId, text)) this.closeEdit();
  }

  protected closeEdit(): void {
    this.editing.set(false);
    const s = this.section();
    if (s) this.editor.clearError(`answer:${s.id}`);
    this.#focus.to(`edit-answer:${this.language().id}`);
  }

  protected closeAudio(): void {
    this.audio.set(false);
    this.#focus.to(`answer-audio:${this.language().id}`);
  }
}
