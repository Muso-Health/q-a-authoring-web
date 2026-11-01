import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../core/catalog/catalog.model';
import { Translator } from '../../core/i18n/translator';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { FocusReturn } from '../../shared/ui/focus-return';
import { ModalDialog } from '../../shared/ui/modal-dialog';
import { TextEditor } from '../../shared/ui/text-editor';
import { Toolbar, type ToolbarAction } from '../../shared/ui/toolbar';
import { AudioDialog } from './audio-dialog';
import { ConceptEditor } from './concept-editor';
import type { ItemView } from './concept-view';
import { ItemAudios } from './item-audios';
import { TranslateForm, type TranslationRequest } from './translate-form';

/** What a tool opened: one at a time per item. */
type Panel = 'edit' | 'audio' | 'translate' | 'delete';

/**
 * Where the variant shows: in its language's tab, as « la variante N »; or in the principal pair,
 * as that language's main question — named by its language there, since every pair has a variant 1.
 */
export type VariantContext = 'section' | 'pair';

/**
 * One question variant: its text with its tools on the same line — edit, manage audio, translate,
 * delete — each opening its modal, and its audios below.
 */
@Component({
  selector: 'app-variant-item',
  imports: [
    TranslocoPipe,
    AudioDialog,
    ConfirmDialog,
    ItemAudios,
    ModalDialog,
    TextEditor,
    Toolbar,
    TranslateForm,
  ],
  template: `
    @let v = variant();
    @let l = labels();
    <div class="line">
      <p class="text" [attr.lang]="language().code">{{ v.text }}</p>
      @if (tools().length > 0) {
        <app-toolbar [label]="l.toolbar" [actions]="tools()" />
      }
    </div>
    <app-item-audios role="variant" [qasetId]="qasetId()" [item]="v" [label]="l.item" />
    @if (context() === 'section' && !panel()) {
      @if (editor.errorFor('variant:' + v.id); as message) {
        <p class="field-error" role="alert">{{ message }}</p>
      }
    }

    @switch (panel()) {
      @case ('edit') {
        <app-dialog [title]="l.editTitle" [locked]="editor.busy()" (dismissed)="close('edit')">
          <app-text-editor
            [label]="l.field"
            [initial]="v.text"
            [lang]="language().code"
            [busy]="editor.busy()"
            [error]="editor.errorFor('variant:' + v.id)"
            (save)="save($event)"
            (cancel)="close('edit')"
          />
        </app-dialog>
      }
      @case ('audio') {
        <app-audio-dialog
          role="variant"
          [qasetId]="qasetId()"
          [item]="v"
          [language]="language()"
          [label]="l.item"
          (closed)="close('audio', 'audio:' + v.id)"
        />
      }
      @case ('delete') {
        <app-confirm-dialog
          [title]="l.deleteTitle"
          [warning]="l.deleteWarning"
          [confirmLabel]="'authoring.delete' | transloco"
          [busy]="editor.busy()"
          [error]="editor.errorFor('variant:' + v.id)"
          (confirmed)="remove()"
          (cancel)="close('delete')"
        />
      }
      @case ('translate') {
        <app-dialog
          [title]="l.translate"
          [locked]="editor.busy()"
          (dismissed)="close('translate', 'translate:' + v.id)"
        >
          <app-translate-form
            [languages]="editor.variantTargets(language().id)"
            [busy]="editor.busy()"
            [error]="editor.errorFor('translate:' + v.id)"
            (submitted)="translate($event)"
            (cancel)="close('translate', 'translate:' + v.id)"
          />
        </app-dialog>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1) var(--muso-space-2);
    }
    .text {
      flex: 1 1 12rem;
      min-inline-size: 0;
      margin: 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class VariantItem {
  protected readonly editor = inject(ConceptEditor);
  readonly #focus = inject(FocusReturn);
  readonly #t = inject(Translator);

  readonly qasetId = input.required<string>();
  readonly language = input.required<Language>();
  readonly variant = input.required<ItemView>();
  /** Its rank in its QASet, from 1: the main question is 1. */
  readonly number = input.required<number>();
  readonly context = input<VariantContext>('section');

  protected readonly panel = signal<Panel | null>(null);

  protected readonly labels = computed(() => {
    const number = this.number();
    const language = this.language().name;
    if (this.context() === 'pair') {
      return {
        toolbar: this.#t.t('tools.main.toolbar', { language }),
        edit: this.#t.t('tools.main.edit', { language }),
        editTitle: this.#t.t('tools.main.edit', { language }),
        field: this.#t.t('tools.main.field', { language }),
        audio: this.#t.t('tools.main.audio', { language }),
        item: this.#t.t('concept.mainQuestionAudio'),
        translate: this.#t.t('tools.main.translate', { language }),
        delete: this.#t.t('tools.main.delete', { language }),
        deleteTitle: this.#t.t('tools.main.deleteTitle', { language }),
        deleteWarning: this.#t.t('tools.main.deleteWarning', { language }),
      };
    }
    return {
      toolbar: this.#t.t('tools.variant', { number }),
      edit: this.#t.t('authoring.editVariantName', { number }),
      editTitle: this.#t.t('authoring.editVariantTitle', { number, language }),
      field: this.#t.t('authoring.variantLabel', { number, language }),
      audio: this.#t.t('tools.variantAudio', { number }),
      item: this.#t.t('concept.variantAudio', { number }),
      translate: this.#t.t('authoring.translate.variantName', { number }),
      delete: this.#t.t('authoring.deleteVariant.name', { number }),
      deleteTitle: this.#t.t('authoring.deleteVariant.title', { number }),
      deleteWarning: this.#t.t('authoring.deleteVariant.warning', { number }),
    };
  });

  protected readonly tools = computed<readonly ToolbarAction[]>(() => {
    const l = this.labels();
    const busy = this.editor.busy();
    const author = this.editor.canAuthor();
    const translatable = this.editor.variantTargets(this.language().id).length > 0;
    const tool = (panel: Panel, icon: ToolbarAction['icon'], label: string): ToolbarAction => ({
      id: this.#key(panel),
      icon,
      label,
      disabled: busy,
      handler: () => this.panel.set(panel),
    });
    return [
      ...(author ? [tool('edit', 'edit', l.edit)] : []),
      ...(this.editor.canManageAudio() ? [tool('audio', 'audio', l.audio)] : []),
      ...(author && translatable ? [tool('translate', 'translate', l.translate)] : []),
      ...(author ? [tool('delete', 'delete', l.delete)] : []),
    ];
  });

  protected async save(text: string): Promise<void> {
    if (await this.editor.editVariant(this.qasetId(), this.variant().id, text)) this.close('edit');
  }

  /** Once deleted, its tool is gone with it: focus has nowhere to return. */
  protected async remove(): Promise<void> {
    if (await this.editor.deleteVariant(this.qasetId(), this.variant().id)) this.panel.set(null);
  }

  protected async translate({ targetLanguageId, engine }: TranslationRequest): Promise<void> {
    const { id } = this.variant();
    if (await this.editor.translateVariant(this.qasetId(), id, targetLanguageId, engine)) {
      this.close('translate', `translate:${id}`);
    }
  }

  /** Closes a panel, forgets its refusal, and gives focus back to its tool. */
  protected close(panel: Panel, target = `variant:${this.variant().id}`): void {
    this.panel.set(null);
    this.editor.clearError(target);
    this.#focus.to(this.#key(panel));
  }

  /** Unique on the page, whichever place the variant shows in. */
  #key(panel: Panel): string {
    return `${this.context()}-${panel}:${this.variant().id}`;
  }
}
