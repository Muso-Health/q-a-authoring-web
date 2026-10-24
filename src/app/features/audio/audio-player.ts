import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AudioApi } from '../../core/audio/audio-api';

export interface PlayableAudio {
  readonly id: string;
  readonly durationMs: number;
}

/** m:ss */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Plays one recording. Nothing is fetched until the listener asks: the signed URL is requested on
 * play, then handed to a native `<audio>` element.
 */
@Component({
  selector: 'app-audio-player',
  imports: [TranslocoPipe],
  template: `
    @if (url.hasValue() && !broken()) {
      <audio
        controls
        autoplay
        preload="none"
        [src]="url.value()"
        (error)="broken.set(true)"
      ></audio>
    } @else if (url.isLoading()) {
      <span class="muso-meta" role="status">{{ 'audio.loading' | transloco }}</span>
    } @else {
      @if (url.error() || broken()) {
        <span class="failed" role="alert">{{ 'audio.failed' | transloco }}</span>
      }
      <button
        type="button"
        class="play"
        [attr.aria-label]="('audio.play' | transloco) + ' ' + label() + ' (' + duration() + ')'"
        (click)="play()"
      >
        <span aria-hidden="true">▶</span>
        {{ (url.error() || broken() ? 'audio.retry' : 'audio.play') | transloco }}
        <span class="duration">{{ duration() }}</span>
      </button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--muso-space-1);
      flex-wrap: wrap;
    }
    audio {
      block-size: 2.25rem;
      max-inline-size: 100%;
    }
    .play {
      display: inline-flex;
      align-items: center;
      gap: var(--muso-space-1);
      padding: 0.3rem 0.75rem;
      font-size: var(--muso-body-sm-size);
    }
    .duration {
      font-weight: 400;
      font-variant-numeric: tabular-nums;
    }
    .failed {
      color: var(--danger-fg);
      font-size: var(--muso-body-sm-size);
    }
  `,
})
export class AudioPlayer {
  readonly #audio = inject(AudioApi);

  readonly audio = input.required<PlayableAudio>();
  /** What is being played, completing "Écouter …" for assistive technology. */
  readonly label = input.required<string>();

  readonly #requested = signal(0);
  protected readonly broken = signal(false);
  protected readonly duration = computed(() => formatDuration(this.audio().durationMs));

  protected readonly url = resource({
    params: () =>
      this.#requested() > 0 ? { id: this.audio().id, attempt: this.#requested() } : undefined,
    loader: ({ params }) => this.#audio.playbackUrl(params.id),
  });

  protected play(): void {
    this.broken.set(false);
    this.#requested.update((n) => n + 1);
  }
}
