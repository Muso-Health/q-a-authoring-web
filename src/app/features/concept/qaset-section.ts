import { Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { Translator } from '../../core/i18n/translator';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { ModalDialog } from '../../shared/ui/modal-dialog';
import { TextEditor } from '../../shared/ui/text-editor';
import { Toolbar, type ToolbarAction } from '../../shared/ui/toolbar';
import { ValidationBadge } from '../../shared/ui/validation-badge';
import { AudioDialog } from './audio-dialog';
import { ConceptEditor } from './concept-editor';
import type { ItemView, QASetSectionView } from './concept-view';
import { ItemAudios } from './item-audios';
import { TranslateForm, type TranslationRequest } from './translate-form';
import { VariantGenerator } from './variant-generator';

/** What a variant's tool opened: one at a time per section. */
type VariantPanel = 'edit' | 'audio' | 'delete' | 'translate';

/**
 * One language of a concept — its QASet. Its answer and main question (the first variant) come
 * first, together; the other variants follow. The answer has the per-language tools (edit,
 * generate, audio), each variant its own (edit, audio, translate, delete); each tool opens a modal.
 */
@Component({
  selector: 'app-qaset-section',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    AudioDialog,
    ConfirmAction,
    ConfirmDialog,
    ItemAudios,
    ModalDialog,
    TextEditor,
    Toolbar,
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
  readonly #t = inject(Translator);

  readonly section = input.required<QASetSectionView>();

  protected readonly main = computed<ItemView | null>(() => this.section().variants[0] ?? null);
  protected readonly others = computed(() => this.section().variants.slice(1));

  protected readonly editingAnswer = signal(false);
  protected readonly generating = signal(false);
  protected readonly answerAudio = signal(false);
  protected readonly addingVariant = signal(false);
  /** The variant whose tool is open, and which. */
  protected readonly open = signal<{ id: string; panel: VariantPanel } | null>(null);

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

  /** Each variant's tools, by its id; its number is its rank, the main question being 1. */
  protected readonly variantTools = computed(() => {
    const busy = this.editor.busy();
    const author = this.editor.canAuthor();
    const audio = this.editor.canManageAudio();
    const translatable = this.editor.variantTargets(this.section().language.id).length > 0;
    const tools = new Map<string, readonly ToolbarAction[]>();
    this.section().variants.forEach(({ id }, index) => {
      const number = index + 1;
      const opener = (
        panel: VariantPanel,
        key: string,
        icon: ToolbarAction['icon'],
        label: string,
      ) => ({
        id: `${key}:${id}`,
        icon,
        label,
        disabled: busy,
        handler: () => this.open.set({ id, panel }),
      });
      tools.set(id, [
        ...(author
          ? [
              opener(
                'edit',
                'edit-variant',
                'edit',
                this.#t.t('authoring.editVariantName', { number }),
              ),
            ]
          : []),
        ...(audio
          ? [opener('audio', 'variant-audio', 'audio', this.#t.t('tools.variantAudio', { number }))]
          : []),
        ...(author && translatable
          ? [
              opener(
                'translate',
                'translate',
                'translate',
                this.#t.t('authoring.translate.variantName', { number }),
              ),
            ]
          : []),
        ...(author
          ? [
              opener(
                'delete',
                'delete-variant',
                'delete',
                this.#t.t('authoring.deleteVariant.name', { number }),
              ),
            ]
          : []),
      ]);
    });
    return tools;
  });

  protected isOpen(id: string, panel: VariantPanel): boolean {
    const open = this.open();
    return open?.id === id && open.panel === panel;
  }

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

  protected async saveVariant(variantId: string, text: string): Promise<void> {
    if (await this.editor.editVariant(this.section().id, variantId, text)) {
      this.closeVariant(variantId, 'edit-variant');
    }
  }

  protected async deleteVariant(variantId: string): Promise<void> {
    if (await this.editor.deleteVariant(this.section().id, variantId)) this.open.set(null);
  }

  protected async translateVariant(
    variantId: string,
    { targetLanguageId, engine }: TranslationRequest,
  ): Promise<void> {
    const qasetId = this.section().id;
    if (await this.editor.translateVariant(qasetId, variantId, targetLanguageId, engine)) {
      this.open.set(null);
      this.#focus.to(`translate:${variantId}`);
    }
  }

  /** Closes a variant's panel, forgets its refusal, and gives focus back to its tool. */
  protected closeVariant(variantId: string, key: string, target = `variant:${variantId}`): void {
    this.open.set(null);
    this.#done(target, `${key}:${variantId}`);
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
