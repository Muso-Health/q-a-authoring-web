import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { Icon } from '../../shared/ui/icon';
import { TextEditor } from '../../shared/ui/text-editor';
import { ValidationBadge } from '../../shared/ui/validation-badge';
import { ConceptEditor } from './concept-editor';
import type { QASetSectionView } from './concept-view';
import { VariantGenerator } from './variant-generator';
import { VariantItem } from './variant-item';

/**
 * One language's QASet, as its tab shows it: its validation state, its counts, and its question
 * variants past the main one — each with its tools (`VariantItem`) — then adding a variant, or
 * generating some.
 */
@Component({
  selector: 'app-qaset-section',
  imports: [
    TranslocoPipe,
    ConfirmAction,
    Icon,
    TextEditor,
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

  readonly section = input.required<QASetSectionView>();

  protected readonly others = computed(() => this.section().variants.slice(1));

  protected readonly generating = signal(false);
  protected readonly addingVariant = signal(false);

  protected closeGenerator(): void {
    this.generating.set(false);
    this.#focus.to(`generate:${this.section().id}`);
  }

  protected async addVariant(text: string): Promise<void> {
    if (await this.editor.addVariant(this.section().id, text)) this.closeAddVariant();
  }

  protected closeAddVariant(): void {
    this.addingVariant.set(false);
    this.editor.clearError(`add-variant:${this.section().id}`);
    this.#focus.to(`add-variant:${this.section().id}`);
  }
}
