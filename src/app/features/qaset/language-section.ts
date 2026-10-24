import { Component, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { TextEditor } from '../../shared/ui/text-editor';
import { ItemMeta } from './item-meta';
import { TranslateForm, type TranslationRequest } from './translate-form';
import { VariantGenerator } from './variant-generator';
import { QASetEditor } from './qaset-editor';
import type { LanguageSectionView } from './qaset-view';

/**
 * One language of a QASet: its counts, its answer, then its variants in creation order. With
 * `author_qasets`, each piece edits in place; the read layout is unchanged otherwise.
 */
@Component({
  selector: 'app-language-section',
  imports: [TranslocoPipe, ConfirmAction, ItemMeta, TextEditor, TranslateForm, VariantGenerator],
  templateUrl: './language-section.html',
  styleUrl: './language-section.scss',
})
export class LanguageSection {
  protected readonly editor = inject(QASetEditor);

  readonly section = input.required<LanguageSectionView>();

  protected readonly editingAnswer = signal(false);
  protected readonly editingVariant = signal<string | null>(null);
  protected readonly addingVariant = signal(false);
  /** The answer or variant whose translation form is open. */
  protected readonly translating = signal<string | null>(null);
  protected readonly generating = signal(false);

  protected async saveAnswer(text: string): Promise<void> {
    if (await this.editor.editAnswer(this.section().language.id, text)) {
      this.editingAnswer.set(false);
    }
  }

  protected async saveVariant(variantId: string, text: string): Promise<void> {
    if (await this.editor.editVariant(variantId, text)) this.editingVariant.set(null);
  }

  protected async addVariant(text: string): Promise<void> {
    if (await this.editor.addVariant(this.section().language.id, text)) {
      this.addingVariant.set(false);
    }
  }

  protected async translateAnswer({ targetLanguageId, engine }: TranslationRequest): Promise<void> {
    const answerId = this.section().answer.id;
    if (await this.editor.translateAnswer(answerId, targetLanguageId, engine)) {
      this.translating.set(null);
    }
  }

  protected async translateVariant(
    variantId: string,
    { targetLanguageId, engine }: TranslationRequest,
  ): Promise<void> {
    if (await this.editor.translateVariant(variantId, targetLanguageId, engine)) {
      this.translating.set(null);
    }
  }

  protected readonly cancelTranslation = () => this.translating.set(null);
  protected readonly cancelAnswer = () => this.editingAnswer.set(false);
  protected readonly cancelVariant = () => this.editingVariant.set(null);
  protected readonly cancelAddVariant = () => this.addingVariant.set(false);

  protected close(target: string, close: () => void): void {
    close();
    this.editor.clearError(target);
  }
}
