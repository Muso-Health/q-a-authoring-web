import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ValidationBadge } from '../../shared/ui/validation-badge';
import { AudioPlayer } from '../audio/audio-player';
import type { ItemView } from './qaset-view';

/** What hangs off an answer or a variant: its audio, its translation state and its links. */
@Component({
  selector: 'app-item-meta',
  imports: [RouterLink, TranslocoPipe, AudioPlayer, ValidationBadge],
  template: `
    @let it = item();
    <div class="audio">
      @if (it.audio; as audio) {
        <app-audio-player [audio]="audio" [label]="label()" />
        <app-validation-badge kind="audio" [status]="audio.quality" />
      } @else {
        <span class="no-audio muso-meta">{{ 'qaset.noAudio' | transloco }}</span>
      }
    </div>
    @if (it.translation; as translation) {
      <app-validation-badge kind="translation" [status]="translation" />
    }
    @if (it.links.length > 0) {
      <div class="links">
        <span class="muso-meta">{{ 'qaset.translatedAs' | transloco }}</span>
        <ul>
          @for (link of it.links; track link.otherId) {
            <li>
              <a [routerLink]="[]" [fragment]="'item-' + link.otherId">{{ link.language.name }}</a>
            </li>
          }
        </ul>
      </div>
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
    .audio,
    .links,
    ul {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1);
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
})
export class ItemMeta {
  readonly item = input.required<ItemView>();
  /** Names the item for the audio player's accessible label. */
  readonly label = input.required<string>();
}
