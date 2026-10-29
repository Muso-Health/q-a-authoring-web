import { Component, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { TextEditor } from '../../shared/ui/text-editor';
import { ValidationBadge } from '../../shared/ui/validation-badge';
import { ConceptEditor } from './concept-editor';
import type { QASetSectionView } from './concept-view';
import { ItemAudios } from './item-audios';
import { TranslateForm, type TranslationRequest } from './translate-form';
import { VariantGenerator } from './variant-generator';

/**
 * One language of a concept — its QASet: its validation state, its answer, then its question
 * variants in creation order, each with its audios per voice. With `author_qasets`, each piece
 * edits in place; the read layout is unchanged otherwise.
 */
@Component({
  selector: 'app-qaset-section',
  imports: [
    TranslocoPipe,
    ConfirmAction,
    ItemAudios,
    TextEditor,
    TranslateForm,
    ValidationBadge,
    VariantGenerator,
    FocusReturnTarget,
  ],
  templateUrl: './qaset-section.html',
  styleUrl: './qaset-section.scss',
})
export class QASetSection {
  protected readonly editor = inject(ConceptEditor);
  readonly #focus = inject(FocusReturn);

  readonly section = input.required<QASetSectionView>();

  protected readonly editingAnswer = signal(false);
  protected readonly editingVariant = signal<string | null>(null);
  protected readonly addingVariant = signal(false);
  /** The variant whose translation form is open. */
  protected readonly translating = signal<string | null>(null);
  protected readonly generating = signal(false);

  protected async saveAnswer(text: string): Promise<void> {
    const qasetId = this.section().id;
    if (await this.editor.editAnswer(qasetId, text)) {
      this.editingAnswer.set(false);
      this.#focus.to(`edit-answer:${qasetId}`);
    }
  }

  protected async saveVariant(variantId: string, text: string): Promise<void> {
    if (await this.editor.editVariant(this.section().id, variantId, text)) {
      this.editingVariant.set(null);
      this.#focus.to(`edit-variant:${variantId}`);
    }
  }

  protected async addVariant(text: string): Promise<void> {
    const qasetId = this.section().id;
    if (await this.editor.addVariant(qasetId, text)) {
      this.addingVariant.set(false);
      this.#focus.to(`add-variant:${qasetId}`);
    }
  }

  protected async translateVariant(
    variantId: string,
    { targetLanguageId, engine }: TranslationRequest,
  ): Promise<void> {
    const qasetId = this.section().id;
    if (await this.editor.translateVariant(qasetId, variantId, targetLanguageId, engine)) {
      this.translating.set(null);
      this.#focus.to(`translate:${variantId}`);
    }
  }

  protected readonly cancelTranslation = () => this.translating.set(null);
  protected readonly cancelAnswer = () => this.editingAnswer.set(false);
  protected readonly cancelVariant = () => this.editingVariant.set(null);
  protected readonly cancelAddVariant = () => this.addingVariant.set(false);

  /** Closes a panel, forgets its refusal, and returns focus to the control that opened it. */
  protected close(target: string, close: () => void, opener = target): void {
    close();
    this.editor.clearError(target);
    this.#focus.to(opener);
  }

  protected closeGenerator(): void {
    this.generating.set(false);
    this.#focus.to(`generate:${this.section().id}`);
  }
}
