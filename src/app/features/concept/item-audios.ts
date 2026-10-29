import { Component, inject, input, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { ValidationBadge } from '../../shared/ui/validation-badge';
import { AudioPlayer } from '../audio/audio-player';
import { AudioCapture } from './audio-capture';
import { ConceptEditor } from './concept-editor';
import type { ItemRole, ItemView } from './concept-view';

/**
 * An answer's or a variant's recordings, one per voice, each with its quality — or nothing at all
 * when it has none. On the page they only play; with `manage` — in the audio modal — each can be
 * replaced or deleted, and a voice added.
 */
@Component({
  selector: 'app-item-audios',
  imports: [TranslocoPipe, AudioPlayer, ConfirmAction, ValidationBadge, AudioCapture],
  template: `
    @let it = item();
    <!-- No audio: nothing to say, so nothing is shown. -->
    @if (it.audios.length > 0) {
      <ul class="audios" [attr.aria-label]="'concept.audios' | transloco: { label: label() }">
        @for (audio of it.audios; track audio.id) {
          @let named = 'concept.audioName' | transloco: { label: label(), voice: audio.voiceName };
          <li class="audio" [attr.data-voice]="audio.voiceId">
            <span class="voice">{{ audio.voiceName }}</span>
            <app-audio-player [audio]="audio" [label]="named" />
            <app-validation-badge kind="audio" [status]="audio.quality" />
            @if (manage()) {
              <span class="manage">
                <button
                  type="button"
                  class="secondary small"
                  [disabled]="editor.busy()"
                  [attr.aria-label]="
                    'capture.replaceName' | transloco: { label: label(), voice: audio.voiceName }
                  "
                  (click)="capture()?.open(audio.voiceId)"
                >
                  {{ 'capture.replace' | transloco }}
                </button>
                <app-confirm-action
                  [small]="true"
                  [label]="'capture.delete' | transloco"
                  [accessibleName]="
                    'capture.deleteName' | transloco: { label: label(), voice: audio.voiceName }
                  "
                  [warning]="
                    'capture.deleteWarning' | transloco: { label: label(), voice: audio.voiceName }
                  "
                  [busy]="editor.busy()"
                  (confirmed)="editor.deleteAudio(qasetId(), role(), it.id, audio.voiceId)"
                />
              </span>
            }
          </li>
        }
      </ul>
    }
    @if (manage()) {
      <app-audio-capture [role]="role()" [qasetId]="qasetId()" [item]="it" [label]="label()" />
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1) var(--muso-space-3);
      margin-block-start: var(--muso-space-1);
    }
    /* Comments (Angular's anchors) still count as empty: no audio leaves no gap. */
    :host(:empty) {
      display: none;
    }
    .audios {
      display: grid;
      flex-basis: 100%;
      gap: var(--muso-space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .audio {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1);
    }
    .voice {
      min-inline-size: 6rem;
      font-weight: 600;
    }
    .manage {
      display: inline-flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
    }
  `,
})
export class ItemAudios {
  protected readonly editor = inject(ConceptEditor);

  readonly item = input.required<ItemView>();
  readonly role = input.required<ItemRole>();
  /** The QASet the item belongs to: its audio endpoints hang off it. */
  readonly qasetId = input.required<string>();
  /** Names the item for the controls' accessible labels: « la réponse », « la variante 2 ». */
  readonly label = input.required<string>();
  /** Replace, delete and add — gated by the caller on `manage_audio`. */
  readonly manage = input(false);

  protected readonly capture = viewChild(AudioCapture);
}
