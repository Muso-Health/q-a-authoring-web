import { Component, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../core/catalog/catalog.model';
import { ModalDialog } from '../../shared/ui/modal-dialog';
import { ConceptEditor } from './concept-editor';
import type { ItemRole, ItemView } from './concept-view';
import { ItemAudios } from './item-audios';

/**
 * The audios of ONE target — an answer or a variant — in a modal: listed per voice, each
 * replaceable or deletable, and a voice to add. Every target has its own; nothing here touches
 * another target's audios.
 */
@Component({
  selector: 'app-audio-dialog',
  imports: [TranslocoPipe, ModalDialog, ItemAudios],
  template: `
    <app-dialog
      [title]="'capture.dialogTitle' | transloco: { label: label(), language: language().name }"
      [locked]="editor.busy()"
      (dismissed)="closed.emit()"
    >
      <app-item-audios
        [manage]="true"
        [role]="role()"
        [qasetId]="qasetId()"
        [item]="item()"
        [label]="label()"
      />
    </app-dialog>
  `,
})
export class AudioDialog {
  protected readonly editor = inject(ConceptEditor);

  readonly qasetId = input.required<string>();
  readonly role = input.required<ItemRole>();
  readonly item = input.required<ItemView>();
  readonly language = input.required<Language>();
  /** The target as a phrase: « la réponse », « la variante 2 ». */
  readonly label = input.required<string>();
  readonly closed = output();
}
