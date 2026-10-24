import { Component, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { TextEditor } from '../../shared/ui/text-editor';
import { Typeahead } from '../../shared/ui/typeahead';
import { ItemMeta } from './item-meta';
import { TranslateForm, type TranslationRequest } from './translate-form';
import { VariantGenerator } from './variant-generator';
import { QASetEditor } from './qaset-editor';
import type { LanguageSectionView, VariantView } from './qaset-view';

/**
 * One language of a QASet: its counts, its answer, then its variants in creation order. With
 * `author_qasets`, each piece edits in place; the read layout is unchanged otherwise.
 */
@Component({
  selector: 'app-language-section',
  imports: [
    TranslocoPipe,
    ConfirmAction,
    ItemMeta,
    TextEditor,
    TranslateForm,
    VariantGenerator,
    Typeahead,
    FocusReturnTarget,
  ],
  templateUrl: './language-section.html',
  styleUrl: './language-section.scss',
})
export class LanguageSection {
  protected readonly editor = inject(QASetEditor);
  readonly #focus = inject(FocusReturn);

  readonly section = input.required<LanguageSectionView>();

  protected readonly editingAnswer = signal(false);
  protected readonly editingVariant = signal<string | null>(null);
  protected readonly addingVariant = signal(false);
  /** The answer or variant whose translation form is open. */
  protected readonly translating = signal<string | null>(null);
  protected readonly generating = signal(false);
  /** The variant whose intent picker is open. */
  protected readonly addingIntent = signal<string | null>(null);

  protected async saveAnswer(text: string): Promise<void> {
    if (await this.editor.editAnswer(this.section().language.id, text)) {
      this.editingAnswer.set(false);
      this.#focus.to(`edit-answer:${this.section().language.id}`);
    }
  }

  protected async saveVariant(variantId: string, text: string): Promise<void> {
    if (await this.editor.editVariant(variantId, text)) {
      this.editingVariant.set(null);
      this.#focus.to(`edit-variant:${variantId}`);
    }
  }

  protected async addVariant(text: string): Promise<void> {
    if (await this.editor.addVariant(this.section().language.id, text)) {
      this.addingVariant.set(false);
      this.#focus.to(`add-variant:${this.section().language.id}`);
    }
  }

  protected async translateAnswer({ targetLanguageId, engine }: TranslationRequest): Promise<void> {
    const answerId = this.section().answer.id;
    if (await this.editor.translateAnswer(answerId, targetLanguageId, engine)) {
      this.translating.set(null);
      this.#focus.to(`translate:${answerId}`);
    }
  }

  protected async translateVariant(
    variantId: string,
    { targetLanguageId, engine }: TranslationRequest,
  ): Promise<void> {
    if (await this.editor.translateVariant(variantId, targetLanguageId, engine)) {
      this.translating.set(null);
      this.#focus.to(`translate:${variantId}`);
    }
  }

  protected intentIds(variant: VariantView): string[] {
    return variant.intents.map((intent) => intent.id);
  }

  protected async attachIntent(variantId: string, intentId: string): Promise<void> {
    if (await this.editor.attachIntent(variantId, intentId)) this.#closeIntent(variantId);
  }

  protected async createIntent(variantId: string, text: string): Promise<void> {
    if (await this.editor.createIntent(variantId, text)) this.#closeIntent(variantId);
  }

  #closeIntent(variantId: string): void {
    this.addingIntent.set(null);
    this.#focus.to(`add-intent:${variantId}`);
  }

  protected readonly cancelIntent = () => this.addingIntent.set(null);
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
    this.#focus.to(`generate:${this.section().answer.id}`);
  }
}
