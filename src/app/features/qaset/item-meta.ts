import { Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ValidationBadge } from '../../shared/ui/validation-badge';
import { AudioPlayer } from '../audio/audio-player';
import { AudioCapture } from './audio-capture';
import { ItemLinks } from './item-links';
import { QASetEditor } from './qaset-editor';
import type { ItemRole, ItemView } from './qaset-view';

/** What hangs off an answer or a variant: its audio, its translation state and its links. */
@Component({
  selector: 'app-item-meta',
  imports: [TranslocoPipe, AudioPlayer, ValidationBadge, ItemLinks, AudioCapture],
  template: `
    @let it = item();
    <div class="audio">
      @if (it.audio; as audio) {
        <app-audio-player [audio]="audio" [label]="label()" />
        <app-validation-badge kind="audio" [status]="audio.quality" />
      } @else {
        <span class="no-audio muso-meta">{{ 'qaset.noAudio' | transloco }}</span>
      }
      @if (editor.canManageAudio()) {
        <app-audio-capture [role]="role()" [item]="it" [label]="label()" />
      }
    </div>
    @if (it.translation; as translation) {
      <app-validation-badge kind="translation" [status]="translation" />
    }
    <app-item-links [item]="it" [role]="role()" />
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1) var(--muso-space-3);
      margin-block-start: var(--muso-space-1);
    }
    .audio {
      display: flex;
      flex-basis: 100%;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1);
    }
  `,
})
export class ItemMeta {
  protected readonly editor = inject(QASetEditor);

  readonly item = input.required<ItemView>();
  readonly role = input.required<ItemRole>();
  /** Names the item for the audio player's accessible label. */
  readonly label = input.required<string>();
}
