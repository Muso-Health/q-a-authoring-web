import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Translator } from '../../core/i18n/translator';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { ModalDialog } from '../../shared/ui/modal-dialog';
import { TextEditor } from '../../shared/ui/text-editor';
import { Toolbar, type ToolbarAction } from '../../shared/ui/toolbar';
import { ValidationBadge } from '../../shared/ui/validation-badge';
import { AudioDialog } from './audio-dialog';
import { ConceptEditor } from './concept-editor';
import type { ItemView, QASetSectionView } from './concept-view';
import { ItemAudios } from './item-audios';
import { VariantGenerator } from './variant-generator';
import { VariantItem } from './variant-item';

/**
 * One language of a concept — its QASet. Its answer and main question (the first variant) come
 * first, together; the other variants follow. The answer has the per-language tools (edit,
 * generate, audio), each variant its own (`VariantItem`); each tool opens a modal.
 */
@Component({
  selector: 'app-qaset-section',
  imports: [
    TranslocoPipe,
    AudioDialog,
    ConfirmAction,
    ItemAudios,
    ModalDialog,
    TextEditor,
    Toolbar,
    ValidationBadge,
    VariantGenerator,
    VariantItem,
    FocusReturnTarget,
  ],
  templateUrl: './qaset-section.html',
  styleUrl: './qaset-section.scss',
})
export class QASetSection {
  protected readonly editor = inject(ConceptEditor);
  readonly #focus = inject(FocusReturn);
  readonly #t = inject(Translator);

  readonly section = input.required<QASetSectionView>();

  protected readonly main = computed<ItemView | null>(() => this.section().variants[0] ?? null);
  protected readonly others = computed(() => this.section().variants.slice(1));

  protected readonly editingAnswer = signal(false);
  protected readonly generating = signal(false);
  protected readonly answerAudio = signal(false);
  protected readonly addingVariant = signal(false);

  protected readonly answerTools = computed<readonly ToolbarAction[]>(() => {
    const id = this.section().id;
    const busy = this.editor.busy();
    return [
      ...(this.editor.canAuthor()
        ? [
            {
              id: `edit-answer:${id}`,
              icon: 'edit' as const,
              label: this.#t.t('authoring.editAnswer'),
              disabled: busy,
              handler: () => this.editingAnswer.set(true),
            },
            {
              id: `generate:${id}`,
              icon: 'generate' as const,
              label: this.#t.t('authoring.generate.open'),
              disabled: busy,
              handler: () => this.generating.set(true),
            },
          ]
        : []),
      ...(this.editor.canManageAudio()
        ? [
            {
              id: `answer-audio:${id}`,
              icon: 'audio' as const,
              label: this.#t.t('tools.answerAudio'),
              disabled: busy,
              handler: () => this.answerAudio.set(true),
            },
          ]
        : []),
    ];
  });

  protected async saveAnswer(text: string): Promise<void> {
    if (await this.editor.editAnswer(this.section().id, text)) this.closeAnswer();
  }

  protected closeAnswer(): void {
    this.editingAnswer.set(false);
    this.#done(`answer:${this.section().id}`, `edit-answer:${this.section().id}`);
  }

  protected closeGenerator(): void {
    this.generating.set(false);
    this.#focus.to(`generate:${this.section().id}`);
  }

  protected closeAnswerAudio(): void {
    this.answerAudio.set(false);
    this.#focus.to(`answer-audio:${this.section().id}`);
  }

  protected async addVariant(text: string): Promise<void> {
    if (await this.editor.addVariant(this.section().id, text)) this.closeAddVariant();
  }

  protected closeAddVariant(): void {
    this.addingVariant.set(false);
    this.#done(`add-variant:${this.section().id}`);
  }

  #done(target: string, opener = target): void {
    this.editor.clearError(target);
    this.#focus.to(opener);
  }
}
